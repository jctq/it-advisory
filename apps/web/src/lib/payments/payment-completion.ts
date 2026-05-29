import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import type { PaymentGatewayId, PaymentPolicy, PaymentStatus } from '@/domain/payment-types';
import {
  createBookingWithLatestQuizSnapshot,
  findBookingByVisitorSlot,
  insertMarketingBooking,
  linkQuizSessionToVisitorBooking,
} from '@/lib/data/bookings';
import { insertMarketingBookingLead, type MarketingBookingLeadContact } from '@/lib/data/leads';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { findPaymentTransactionById, updatePaymentTransactionStatus, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';
import { getDb } from '@/lib/mongodb';
import { executeSendBookingConfirmationEmail } from '@/lib/email/send-booking-confirmation-email';
import { incrementPromoRedemptionCount } from '@/lib/data/monetization-settings';
import { syncBookingRecordingFieldsFromTransaction } from '@/lib/booking/apply-booking-recording-fields';
import { ensureVideoMeetingStoredForBooking } from '@/lib/video-meetings/ensure-video-meeting-for-booking';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

async function ensureTransactionBookingLinkedToQuizSession(
  transaction: PaymentTransactionRow,
  bookingId: ObjectId,
): Promise<void> {
  const quizSessionHex = transaction.quizSessionIdHex?.trim() ?? '';
  if (quizSessionHex.length === 0) {
    return;
  }
  await linkQuizSessionToVisitorBooking({
    bookingId,
    visitorId: transaction.visitorId,
    quizSessionIdHex: quizSessionHex,
  });
}

async function resolveQuizSnapshot(
  visitorId: string,
  quizSessionIdHex: string | null,
): Promise<{ readonly quizSessionId: ObjectId | null; readonly snapshot: string | null }> {
  const preferredRaw = quizSessionIdHex?.trim() ?? '';
  let session =
    preferredRaw.length > 0 && /^[a-f\d]{24}$/i.test(preferredRaw)
      ? await findQuizSessionForVisitor(visitorId, preferredRaw)
      : null;
  if (session === null) {
    return { quizSessionId: null, snapshot: null };
  }
  const quizSessionId = session._id ?? null;
  const snapshot =
    session.answers !== undefined ? extractGuidedDiagnosticRawFromQuizAnswers(session.answers) : null;
  return { quizSessionId, snapshot };
}

async function confirmBookingRow(bookingId: ObjectId): Promise<void> {
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId, status: { $nin: ['completed', 'cancelled'] } },
    { $set: { status: 'confirmed', updatedAt: new Date() } },
  );
}

async function cancelBookingRow(bookingId: ObjectId): Promise<void> {
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId },
    { $set: { status: 'cancelled', updatedAt: new Date() } },
  );
}

export async function cancelBookingById(bookingId: ObjectId): Promise<void> {
  await cancelBookingRow(bookingId);
}

export type ExpiredPaymentBookingDisposition = 'cancel' | 'retain_pending';

/** Clears an expired checkout hold while keeping the booking row pending for rebook / manage flows. */
export async function resetBookingAfterExpiredPaymentHold(bookingId: ObjectId): Promise<void> {
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId, status: { $nin: ['completed', 'cancelled'] } },
    {
      $set: {
        status: 'pending',
        paymentStatus: 'expired',
        updatedAt: new Date(),
      },
      $unset: {
        paymentExpiresAt: '',
      },
    },
  );
}

export type UpdateBookingStatusByAdminResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'not_found' | 'invalid_status' | 'database_unavailable' };

export async function updateBookingStatusByAdmin(
  bookingId: string,
  status: BookingDocument['status'],
): Promise<UpdateBookingStatusByAdminResult> {
  if (!process.env.MONGODB_URI) {
    return { ok: false, code: 'database_unavailable' };
  }
  if (status !== 'pending' && status !== 'confirmed' && status !== 'completed' && status !== 'cancelled') {
    return { ok: false, code: 'invalid_status' };
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookingId);
  } catch {
    return { ok: false, code: 'not_found' };
  }
  const db = await getDb();
  const existing = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: objectId });
  if (existing === null) {
    return { ok: false, code: 'not_found' };
  }
  if (existing.status === status) {
    return { ok: true };
  }
  if (status === 'cancelled') {
    const paymentTransactionId = existing.paymentTransactionId;
    if (paymentTransactionId !== undefined && paymentTransactionId !== null) {
      const transaction = await findPaymentTransactionById(paymentTransactionId.toString());
      if (
        transaction !== null &&
        (transaction.status === 'pending' || transaction.status === 'processing')
      ) {
        await applyPaymentStatusToBooking({
          transaction,
          nextStatus: 'expired',
          expiredBookingDisposition: 'retain_pending',
        });
        return { ok: true };
      }
    }
    await cancelBookingRow(objectId);
    return { ok: true };
  }
  if (status === 'confirmed') {
    await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
      { _id: objectId },
      {
        $set: {
          status: 'confirmed',
          paymentStatus: 'paid',
          updatedAt: new Date(),
        },
      },
    );
    await ensureVideoMeetingStoredForBooking(objectId);
    return { ok: true };
  }
  if (status === 'completed') {
    await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
      { _id: objectId },
      {
        $set: {
          status: 'completed',
          updatedAt: new Date(),
        },
      },
    );
    return { ok: true };
  }
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: objectId },
    {
      $set: {
        status: 'pending',
        updatedAt: new Date(),
      },
    },
  );
  return { ok: true };
}

export type CompletePaymentTransactionResult =
  | { readonly kind: 'updated'; readonly transaction: PaymentTransactionRow }
  | { readonly kind: 'noop'; readonly transaction: PaymentTransactionRow }
  | null;

export async function applyPaymentStatusToBooking(input: {
  readonly transaction: PaymentTransactionRow;
  readonly nextStatus: PaymentStatus;
  readonly expiredBookingDisposition?: ExpiredPaymentBookingDisposition;
}): Promise<CompletePaymentTransactionResult> {
  const { transaction, nextStatus, expiredBookingDisposition = 'cancel' } = input;
  if (transaction.status === nextStatus && transaction.bookingId !== null) {
    return { kind: 'noop', transaction };
  }
  if (nextStatus === 'paid') {
    return fulfillPaidTransaction(transaction);
  }
  if (nextStatus === 'failed' || nextStatus === 'expired') {
    return failTransaction(transaction, nextStatus, expiredBookingDisposition);
  }
  const updated = await updatePaymentTransactionStatus({
    transactionId: transaction.id,
    status: nextStatus,
  });
  return updated === null ? null : { kind: 'updated', transaction: updated };
}

async function fulfillPaidTransaction(transaction: PaymentTransactionRow): Promise<CompletePaymentTransactionResult> {
  if (transaction.status === 'paid' && transaction.bookingId !== null) {
    const bookingObjectId = new ObjectId(transaction.bookingId);
    await syncBookingRecordingFieldsFromTransaction({
      bookingId: bookingObjectId,
      metadata: transaction.metadata,
    });
    await ensureTransactionBookingLinkedToQuizSession(transaction, bookingObjectId);
    return { kind: 'noop', transaction };
  }
  let bookingId: ObjectId | null = transaction.bookingId !== null ? new ObjectId(transaction.bookingId) : null;
  if (bookingId === null) {
    bookingId = await createBookingForTransaction(transaction);
  }
  if (bookingId === null) {
    return null;
  }
  const db = await getDb();
  const existingBooking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    { _id: bookingId },
    { projection: { status: 1, paymentStatus: 1 } },
  );
  if (
    (existingBooking?.status === 'confirmed' || existingBooking?.status === 'completed') &&
    existingBooking.paymentStatus === 'paid'
  ) {
    await syncBookingRecordingFieldsFromTransaction({
      bookingId,
      metadata: transaction.metadata,
    });
    await ensureVideoMeetingStoredForBooking(bookingId);
    await ensureTransactionBookingLinkedToQuizSession(transaction, bookingId);
    const updated = await updatePaymentTransactionStatus({
      transactionId: transaction.id,
      status: 'paid',
      bookingId,
    });
    if (updated === null) {
      return null;
    }
    return { kind: 'noop', transaction: updated };
  }
  await syncBookingRecordingFieldsFromTransaction({
    bookingId,
    metadata: transaction.metadata,
  });
  await confirmBookingRow(bookingId);
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId },
    {
      $set: {
        paymentStatus: 'paid',
        paymentGatewayId: transaction.gatewayId,
        paymentTransactionId: new ObjectId(transaction.id),
        paymentProviderRef: transaction.providerRef,
        paymentMethodLabel: transaction.paymentMethodLabel,
        updatedAt: new Date(),
      },
    },
  );
  await ensureVideoMeetingStoredForBooking(bookingId);
  await ensureTransactionBookingLinkedToQuizSession(transaction, bookingId);
  const updated = await updatePaymentTransactionStatus({
    transactionId: transaction.id,
    status: 'paid',
    bookingId,
  });
  if (updated === null) {
    return null;
  }
  void executeSendBookingConfirmationEmail({
    bookingId: bookingId.toHexString(),
    transaction: updated,
  }).catch((err: unknown) => {
    console.error('[booking-email] fulfillPaidTransaction', err);
  });
  const promoCode = await loadTransactionPromoCode(transaction.id);
  if (promoCode !== null) {
    void incrementPromoRedemptionCount(promoCode).catch((err: unknown) => {
      console.error('[promo-redemption] fulfillPaidTransaction', err);
    });
  }
  return { kind: 'updated', transaction: updated };
}

async function loadTransactionPromoCode(transactionId: string): Promise<string | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.paymentTransactions).findOne(
    { _id: new ObjectId(transactionId) },
    { projection: { metadata: 1 } },
  );
  if (doc === null || typeof doc.metadata !== 'object' || doc.metadata === null) {
    return null;
  }
  const promoCode = (doc.metadata as Record<string, string>).promoCode;
  return typeof promoCode === 'string' && promoCode.trim().length > 0 ? promoCode.trim() : null;
}

async function failTransaction(
  transaction: PaymentTransactionRow,
  nextStatus: PaymentStatus,
  expiredBookingDisposition: ExpiredPaymentBookingDisposition,
): Promise<CompletePaymentTransactionResult> {
  if (transaction.bookingId !== null) {
    const bookingId = new ObjectId(transaction.bookingId);
    if (nextStatus === 'expired' && expiredBookingDisposition === 'retain_pending') {
      await resetBookingAfterExpiredPaymentHold(bookingId);
    } else {
      await cancelBookingRow(bookingId);
    }
  }
  const updated = await updatePaymentTransactionStatus({
    transactionId: transaction.id,
    status: nextStatus,
  });
  return updated === null ? null : { kind: 'updated', transaction: updated };
}

async function createBookingForTransaction(transaction: PaymentTransactionRow): Promise<ObjectId | null> {
  const startsAt = await loadTransactionStartsAt(transaction.id);
  const existing = await findBookingByVisitorSlot({
    visitorId: transaction.visitorId,
    serviceKey: transaction.serviceKey,
    startsAt,
  });
  if (existing !== null) {
    await syncBookingRecordingFieldsFromTransaction({
      bookingId: existing,
      metadata: transaction.metadata,
    });
    await ensureTransactionBookingLinkedToQuizSession(transaction, existing);
    return existing;
  }
  const contact: MarketingBookingLeadContact | null =
    transaction.customerName && transaction.customerEmail && transaction.customerPhone
      ? {
          name: transaction.customerName,
          email: transaction.customerEmail,
          company: transaction.customerCompany ?? '',
          phone: transaction.customerPhone,
        }
      : null;
  let leadId =
    transaction.leadId !== null && transaction.leadId.length > 0 ? new ObjectId(transaction.leadId) : null;
  if (leadId === null && contact !== null) {
    const insertedLeadId = await insertMarketingBookingLead(transaction.visitorId, contact);
    if (insertedLeadId === null) {
      return null;
    }
    leadId = insertedLeadId;
  }
  if (leadId === null) {
    return null;
  }
  const created = await createBookingWithLatestQuizSnapshot({
    visitorId: transaction.visitorId,
    serviceKey: transaction.serviceKey,
    startsAt,
    timezone: transaction.timezone || PRIMARY_TIMEZONE,
    leadId,
    preferredQuizSessionId: transaction.quizSessionIdHex,
    paymentMethodLabel: transaction.paymentMethodLabel,
  });
  if (created === 'quiz_session_not_accessible') {
    return null;
  }
  if (created === null || created === 'duplicate_key') {
    const retry = await findBookingByVisitorSlot({
      visitorId: transaction.visitorId,
      serviceKey: transaction.serviceKey,
      startsAt: await loadTransactionStartsAt(transaction.id),
    });
    if (retry !== null) {
      await ensureTransactionBookingLinkedToQuizSession(transaction, retry);
    }
    return retry;
  }
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: created.bookingId },
    {
      $set: {
        status: transaction.paymentPolicy === 'manual_confirm' ? 'pending' : 'pending',
        paymentStatus: 'paid',
        paymentGatewayId: transaction.gatewayId,
        paymentTransactionId: new ObjectId(transaction.id),
        paymentProviderRef: transaction.providerRef,
        updatedAt: new Date(),
      },
    },
  );
  await syncBookingRecordingFieldsFromTransaction({
    bookingId: created.bookingId,
    metadata: transaction.metadata,
  });
  await ensureTransactionBookingLinkedToQuizSession(transaction, created.bookingId);
  return created.bookingId;
}

async function loadTransactionStartsAt(transactionId: string): Promise<Date> {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.paymentTransactions).findOne({ _id: new ObjectId(transactionId) });
  if (doc && 'startsAt' in doc && doc.startsAt instanceof Date) {
    return doc.startsAt;
  }
  return new Date();
}

export async function createPendingBookingForHoldPolicy(input: {
  readonly transaction: PaymentTransactionRow;
  readonly expiresAt: Date;
}): Promise<ObjectId | null> {
  const { transaction, expiresAt } = input;
  const contact: MarketingBookingLeadContact = {
    name: transaction.customerName ?? '',
    email: transaction.customerEmail ?? '',
    company: transaction.customerCompany ?? '',
    phone: transaction.customerPhone ?? '',
  };
  const leadId = await insertMarketingBookingLead(transaction.visitorId, contact);
  if (leadId === null) {
    return null;
  }
  const { quizSessionId, snapshot } = await resolveQuizSnapshot(transaction.visitorId, transaction.quizSessionIdHex);
  const inserted = await insertMarketingBooking({
    visitorId: transaction.visitorId,
    serviceKey: transaction.serviceKey,
    startsAt: await loadTransactionStartsAt(transaction.id),
    timezone: transaction.timezone || PRIMARY_TIMEZONE,
    leadId,
    quizSessionId,
    guidedDiagnosticSnapshot: snapshot,
    paymentMethodLabel: transaction.paymentMethodLabel,
  });
  let bookingId: ObjectId | null =
    inserted === null || inserted.kind === 'duplicate_key'
      ? await findBookingByVisitorSlot({
          visitorId: transaction.visitorId,
          serviceKey: transaction.serviceKey,
          startsAt: await loadTransactionStartsAt(transaction.id),
        })
      : inserted.id;
  if (bookingId === null) {
    return null;
  }
  const db = await getDb();
  const existingBooking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    { _id: bookingId },
    { projection: { paymentExpiresAt: 1 } },
  );
  const existingExpiresAt =
    existingBooking?.paymentExpiresAt instanceof Date ? existingBooking.paymentExpiresAt : null;
  const resolvedExpiresAt =
    existingExpiresAt !== null && existingExpiresAt.getTime() > Date.now() ? existingExpiresAt : expiresAt;
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId },
    {
      $set: {
        status: 'pending',
        paymentStatus: 'pending',
        paymentGatewayId: transaction.gatewayId,
        paymentTransactionId: new ObjectId(transaction.id),
        paymentProviderRef: transaction.providerRef,
        paymentExpiresAt: resolvedExpiresAt,
        updatedAt: new Date(),
      },
    },
  );
  await db.collection(COLLECTIONS.paymentTransactions).updateOne(
    { _id: new ObjectId(transaction.id) },
    { $set: { expiresAt: resolvedExpiresAt, updatedAt: new Date() } },
  );
  await updatePaymentTransactionStatus({
    transactionId: transaction.id,
    status: 'processing',
    bookingId,
  });
  await syncBookingRecordingFieldsFromTransaction({
    bookingId,
    metadata: transaction.metadata,
  });
  await ensureTransactionBookingLinkedToQuizSession(transaction, bookingId);
  return bookingId;
}

export async function createManualConfirmBooking(input: {
  readonly transaction: PaymentTransactionRow;
}): Promise<ObjectId | null> {
  const startsAt = await loadTransactionStartsAt(input.transaction.id);
  const contact: MarketingBookingLeadContact = {
    name: input.transaction.customerName ?? '',
    email: input.transaction.customerEmail ?? '',
    company: input.transaction.customerCompany ?? '',
    phone: input.transaction.customerPhone ?? '',
  };
  const leadId = await insertMarketingBookingLead(input.transaction.visitorId, contact);
  if (leadId === null) {
    return null;
  }
  const { quizSessionId, snapshot } = await resolveQuizSnapshot(
    input.transaction.visitorId,
    input.transaction.quizSessionIdHex,
  );
  const inserted = await insertMarketingBooking({
    visitorId: input.transaction.visitorId,
    serviceKey: input.transaction.serviceKey,
    startsAt,
    timezone: input.transaction.timezone || PRIMARY_TIMEZONE,
    leadId,
    quizSessionId,
    guidedDiagnosticSnapshot: snapshot,
    paymentMethodLabel: input.transaction.paymentMethodLabel,
  });
  if (inserted === null) {
    return null;
  }
  const bookingId = inserted.kind === 'duplicate_key' ? await findBookingByVisitorSlot({
    visitorId: input.transaction.visitorId,
    serviceKey: input.transaction.serviceKey,
    startsAt,
  }) : inserted.id;
  if (bookingId === null) {
    return null;
  }
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId },
    {
      $set: {
        status: 'pending',
        paymentStatus: 'pending',
        paymentGatewayId: input.transaction.gatewayId,
        paymentTransactionId: new ObjectId(input.transaction.id),
        paymentProviderRef: input.transaction.providerRef,
        updatedAt: new Date(),
      },
    },
  );
  await updatePaymentTransactionStatus({
    transactionId: input.transaction.id,
    status: 'pending',
    bookingId,
  });
  await syncBookingRecordingFieldsFromTransaction({
    bookingId,
    metadata: input.transaction.metadata,
  });
  await ensureTransactionBookingLinkedToQuizSession(input.transaction, bookingId);
  return bookingId;
}

export async function markBookingPaidByAdmin(bookingId: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookingId);
  } catch {
    return false;
  }
  const db = await getDb();
  const result = await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: objectId, status: 'pending' },
    {
      $set: {
        status: 'confirmed',
        paymentStatus: 'paid',
        updatedAt: new Date(),
      },
    },
  );
  const matched = result.matchedCount === 1;
  if (matched) {
    await ensureVideoMeetingStoredForBooking(objectId);
    void executeSendBookingConfirmationEmail({
      bookingId,
      transaction: null,
    }).catch((err: unknown) => {
      console.error('[booking-email] markBookingPaidByAdmin', err);
    });
  }
  return matched;
}

export async function ensurePaidTransactionFulfilled(transaction: PaymentTransactionRow): Promise<PaymentTransactionRow> {
  if (transaction.status === 'paid' && transaction.bookingId !== null) {
    return transaction;
  }
  if (transaction.status !== 'paid' && transaction.status !== 'processing') {
    return transaction;
  }
  const result = await applyPaymentStatusToBooking({ transaction, nextStatus: 'paid' });
  if (result === null) {
    return transaction;
  }
  const refreshed = await findPaymentTransactionById(transaction.id);
  return refreshed ?? transaction;
}

export async function completeMockPayment(transactionId: string, visitorId: string): Promise<CompletePaymentTransactionResult | null> {
  const transaction = await findPaymentTransactionById(transactionId, visitorId);
  if (transaction === null) {
    return null;
  }
  return applyPaymentStatusToBooking({ transaction, nextStatus: 'paid' });
}

export async function processWebhookPaymentEvent(input: {
  readonly gatewayId: PaymentGatewayId;
  readonly providerSessionId: string;
  readonly status: PaymentStatus;
  readonly raw: unknown;
}): Promise<CompletePaymentTransactionResult | null> {
  const { findPaymentTransactionByProviderSession } = await import('@/lib/data/payment-transactions');
  const transaction = await findPaymentTransactionByProviderSession(input.gatewayId, input.providerSessionId);
  if (transaction === null) {
    return null;
  }
  await updatePaymentTransactionStatus({
    transactionId: transaction.id,
    status: input.status === 'paid' ? 'processing' : input.status,
    rawWebhookPayload: input.raw,
  });
  const refreshed = await findPaymentTransactionById(transaction.id);
  if (refreshed === null) {
    return null;
  }
  return applyPaymentStatusToBooking({ transaction: refreshed, nextStatus: input.status });
}

export function resolveInitialBookingStatus(policy: PaymentPolicy): BookingDocument['status'] {
  if (policy === 'pay_before_booking') {
    return 'pending';
  }
  return 'pending';
}
