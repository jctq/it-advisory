import { ObjectId } from 'mongodb';
import type { BookingDocument } from '@/domain/types';
import { COLLECTIONS } from '@/domain/collections';
import { createBookingRefundRequest } from '@/lib/data/booking-refunds';
import {
  isGuestBookingNotFound,
  resolveBookingOwnedByVisitor,
  resolveGuestBookingByCredentials,
  type GuestBookingManageCredentials,
} from '@/lib/data/booking-guest-manage';
import { getPaymentSettings } from '@/lib/data/payment-settings';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import {
  resolveBookingCustomerActionMode,
  type BookingCustomerActionMode,
} from '@/lib/booking/booking-customer-action-eligibility';
import { bookingIdMatchesReferenceInput, normalizeBookingReferenceInput } from '@/lib/marketing/booking-reference';
import { isBookingCancellationAllowedBeforeStart } from '@/lib/booking/booking-cancellation-policy';
import { executeCancelVideoMeetingForBooking } from '@/lib/video-meetings/cancel-video-meeting-for-booking';
import { executeSendBookingCancellationRefundPendingEmail } from '@/lib/email/send-booking-cancellation-refund-pending-email';
import { getDb } from '@/lib/mongodb';

export type BookingCancellationErrorCode =
  | 'cancellation_too_late'
  | 'invalid_booking_reference'
  | 'booking_not_confirmed'
  | 'booking_not_found'
  | 'cancellation_unavailable'
  | 'refunds_disabled'
  | 'server_error';

export type RequestBookingCancellationResult =
  | {
      readonly ok: true;
      readonly bookingId: string;
      readonly mode: BookingCustomerActionMode;
      readonly refundId: string | null;
    }
  | { readonly ok: false; readonly code: BookingCancellationErrorCode; readonly message: string };

const ERROR_MESSAGES: Readonly<Record<BookingCancellationErrorCode, string>> = {
  cancellation_too_late:
    'This action is only allowed at least 24 hours before your scheduled date and time.',
  invalid_booking_reference: 'The booking reference you entered does not match this booking.',
  booking_not_confirmed: 'This booking cannot be cancelled or refunded in its current state.',
  booking_not_found: 'We could not find that booking.',
  cancellation_unavailable: 'This booking is already cancelled or a refund is in progress.',
  refunds_disabled: 'Booking refunds are not available right now.',
  server_error: 'Something went wrong. Please try again later.',
};

function resolveCancellationError(code: BookingCancellationErrorCode): RequestBookingCancellationResult {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}

async function resolveBookingIsPaid(booking: BookingDocument): Promise<boolean> {
  if (booking.paymentStatus === 'paid') {
    return true;
  }
  const paymentTransactionId = booking.paymentTransactionId?.toString() ?? null;
  if (paymentTransactionId === null) {
    return false;
  }
  const transaction = await findPaymentTransactionById(paymentTransactionId);
  return transaction !== null && transaction.status === 'paid';
}

function resolveRequestedRefundAmountCentavos(
  booking: BookingDocument & { _id: ObjectId },
): { readonly amountCentavos: number; readonly paymentTransactionId: string | null; readonly gatewayId: BookingDocument['paymentGatewayId'] } {
  const paymentTransactionId = booking.paymentTransactionId?.toString() ?? null;
  if (paymentTransactionId !== null) {
    return {
      amountCentavos: 0,
      paymentTransactionId,
      gatewayId: booking.paymentGatewayId ?? null,
    };
  }
  const quoted = booking.quotedAmountCentavos;
  return {
    amountCentavos: typeof quoted === 'number' && Number.isFinite(quoted) ? Math.max(0, Math.round(quoted)) : 0,
    paymentTransactionId: null,
    gatewayId: booking.paymentGatewayId ?? null,
  };
}

async function validateBookingForCustomerAction(input: {
  readonly booking: BookingDocument & { _id: ObjectId };
  readonly bookingId: string;
  readonly referenceInput: string;
  readonly mode: BookingCustomerActionMode;
  readonly isPaid: boolean;
}): Promise<RequestBookingCancellationResult | null> {
  const normalizedReference = normalizeBookingReferenceInput(input.referenceInput);
  if (!bookingIdMatchesReferenceInput(input.bookingId, normalizedReference)) {
    return resolveCancellationError('invalid_booking_reference');
  }
  if (
    input.booking.status === 'refund_awaiting' ||
    input.booking.status === 'refunded' ||
    input.booking.status === 'cancelled'
  ) {
    return resolveCancellationError('cancellation_unavailable');
  }
  if (input.mode === 'cancel') {
    if (input.booking.status !== 'confirmed') {
      return resolveCancellationError('booking_not_confirmed');
    }
    if (!isBookingCancellationAllowedBeforeStart(input.booking.startsAt)) {
      return resolveCancellationError('cancellation_too_late');
    }
    return null;
  }
  if (!input.isPaid) {
    return resolveCancellationError('booking_not_confirmed');
  }
  if (input.booking.status !== 'confirmed') {
    return resolveCancellationError('booking_not_confirmed');
  }
  if (!isBookingCancellationAllowedBeforeStart(input.booking.startsAt)) {
    return resolveCancellationError('cancellation_too_late');
  }
  return null;
}

async function executeRefundSideEffects(bookingId: string, refundId: string): Promise<void> {
  void executeCancelVideoMeetingForBooking(bookingId).catch((error: unknown) => {
    console.error('[booking-cancellation] cancel video meeting', error);
  });
  void executeSendBookingCancellationRefundPendingEmail({ bookingId, refundId }).catch((error: unknown) => {
    console.error('[booking-cancellation] send refund pending email', error);
  });
}

async function executeCancelSideEffects(bookingId: string): Promise<void> {
  void executeCancelVideoMeetingForBooking(bookingId).catch((error: unknown) => {
    console.error('[booking-cancellation] cancel video meeting', error);
  });
}

async function persistBookingCancellationOnly(input: {
  readonly booking: BookingDocument & { _id: ObjectId };
  readonly bookingId: string;
}): Promise<RequestBookingCancellationResult> {
  if (!process.env.MONGODB_URI) {
    return resolveCancellationError('server_error');
  }
  const now = new Date();
  const db = await getDb();
  const updateResult = await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: input.booking._id, status: 'confirmed' },
    {
      $set: {
        status: 'cancelled',
        updatedAt: now,
      },
    },
  );
  if (updateResult.matchedCount !== 1) {
    return resolveCancellationError('server_error');
  }
  void executeCancelSideEffects(input.bookingId);
  return { ok: true, bookingId: input.bookingId, mode: 'cancel', refundId: null };
}

async function persistBookingRefundRequest(input: {
  readonly booking: BookingDocument & { _id: ObjectId };
  readonly bookingId: string;
  readonly visitorId: string;
  readonly referenceInput: string;
}): Promise<RequestBookingCancellationResult> {
  let amountCentavos = 0;
  let paymentTransactionId: string | null = null;
  let gatewayId = input.booking.paymentGatewayId ?? null;
  const amountSeed = resolveRequestedRefundAmountCentavos(input.booking);
  paymentTransactionId = amountSeed.paymentTransactionId;
  gatewayId = amountSeed.gatewayId ?? null;
  if (paymentTransactionId !== null) {
    const transaction = await findPaymentTransactionById(paymentTransactionId);
    if (transaction !== null && transaction.status === 'paid') {
      amountCentavos = transaction.amountCentavos;
      gatewayId = transaction.gatewayId;
    } else if (input.booking.paymentStatus === 'paid') {
      amountCentavos = amountSeed.amountCentavos;
    }
  } else if (input.booking.paymentStatus === 'paid') {
    amountCentavos = amountSeed.amountCentavos;
  }
  const createResult = await createBookingRefundRequest({
    bookingId: input.bookingId,
    visitorId: input.visitorId,
    paymentTransactionId,
    requestedAmountCentavos: amountCentavos,
    gatewayId,
    bookingReferenceConfirmed: normalizeBookingReferenceInput(input.referenceInput),
  });
  if (!createResult.ok) {
    return resolveCancellationError('server_error');
  }
  void executeRefundSideEffects(input.bookingId, createResult.refundId);
  return { ok: true, bookingId: input.bookingId, mode: 'refund', refundId: createResult.refundId };
}

async function requestBookingCustomerAction(input: {
  readonly booking: BookingDocument & { _id: ObjectId };
  readonly bookingId: string;
  readonly visitorId: string;
  readonly referenceInput: string;
}): Promise<RequestBookingCancellationResult> {
  if (!process.env.MONGODB_URI) {
    return resolveCancellationError('server_error');
  }
  const settings = await getPaymentSettings();
  const isPaid = await resolveBookingIsPaid(input.booking);
  const mode = resolveBookingCustomerActionMode({
    paymentPolicy: settings.paymentPolicy,
    bookingStatus: input.booking.status,
    isPaid,
    refundsEnabled: settings.refundsEnabled,
  });
  if (mode === null) {
    if (settings.refundsEnabled === false && isPaid) {
      return resolveCancellationError('refunds_disabled');
    }
    return resolveCancellationError('cancellation_unavailable');
  }
  const validationError = await validateBookingForCustomerAction({
    booking: input.booking,
    bookingId: input.bookingId,
    referenceInput: input.referenceInput,
    mode,
    isPaid,
  });
  if (validationError !== null) {
    return validationError;
  }
  if (mode === 'cancel') {
    return persistBookingCancellationOnly({
      booking: input.booking,
      bookingId: input.bookingId,
    });
  }
  return persistBookingRefundRequest({
    booking: input.booking,
    bookingId: input.bookingId,
    visitorId: input.visitorId,
    referenceInput: input.referenceInput,
  });
}

export async function requestAccountBookingCancellation(input: {
  readonly bookingId: string;
  readonly bookingReference: string;
  readonly visitorId: string;
}): Promise<RequestBookingCancellationResult> {
  const resolved = await resolveBookingOwnedByVisitor(input.bookingId, input.visitorId);
  if (isGuestBookingNotFound(resolved)) {
    return resolveCancellationError('booking_not_found');
  }
  return requestBookingCustomerAction({
    booking: resolved.booking,
    bookingId: resolved.bookingId,
    visitorId: input.visitorId,
    referenceInput: input.bookingReference,
  });
}

export async function requestGuestBookingCancellation(input: {
  readonly credentials: GuestBookingManageCredentials;
  readonly confirmReference: string;
}): Promise<RequestBookingCancellationResult> {
  const resolved = await resolveGuestBookingByCredentials(input.credentials);
  if (isGuestBookingNotFound(resolved)) {
    return resolveCancellationError('booking_not_found');
  }
  return requestBookingCustomerAction({
    booking: resolved.booking,
    bookingId: resolved.bookingId,
    visitorId: resolved.booking.visitorId,
    referenceInput: input.confirmReference,
  });
}

export async function findBookingDocumentById(bookingId: string): Promise<(BookingDocument & { _id: ObjectId }) | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookingId);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: objectId });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return doc as BookingDocument & { _id: ObjectId };
}
