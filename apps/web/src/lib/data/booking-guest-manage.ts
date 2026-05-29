import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentPolicy } from '@/domain/payment-types';
import type { BookingDocument, LeadDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';
import {
  formatBookingReferenceId,
  matchesGuestManageContact,
  normalizeBookingReferenceInput,
  normalizeGuestManageEmail,
} from '@/lib/marketing/booking-reference';
import { isOverdueUnpaidPendingBooking } from '@/lib/marketing/overdue-pending-booking';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { getDb } from '@/lib/mongodb';
import { syncAccountProfileToVisitorLeads, isAccountVisitorId } from '@/lib/data/sync-account-profile-to-leads';
import {
  buildMarketingLeadContactFromAccountUser,
  leadNeedsProfileSync,
} from '@/lib/marketing/account-profile-lead-contact';
import { findUserById } from '@/lib/data/users';
import {
  buildBookingPayGuidance,
  type BookingPayGuidance,
} from '@/lib/payments/booking-pay-guidance';
import { syncBookingIfPaymentWindowExpired } from '@/lib/payments/cancel-expired-payment-window-bookings';
import {
  buildBookingNotFoundPayability,
  buildCredentialsMismatchPayability,
  buildVisitorMismatchPayability,
  evaluateBookingPayability,
  type BookingPayabilityCode,
  type BookingPayabilityResult,
} from '@/lib/payments/evaluate-booking-payability';

export type GuestBookingManageCredentials = {
  readonly bookingReference: string;
  readonly email: string;
  readonly phoneLastFour: string;
};

export type GuestBookingManageView = {
  readonly bookingReference: string;
  readonly status: BookingDocument['status'];
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly customerName: string;
  readonly paymentPolicy: PaymentPolicy;
  readonly paymentExpiresAtIso: string | null;
  readonly canPayOnline: boolean;
  readonly payBlockedReason: string | null;
  readonly payGuidance: BookingPayGuidance | null;
  readonly profileSyncAvailable: boolean;
  readonly payabilityCode: BookingPayabilityCode;
  readonly checkoutAmountLabel: string;
  readonly paymentsEnabled: boolean;
  readonly recordingOptIn: boolean;
  readonly fathomNotesUrl: string | null;
  readonly fathomSummaryPreview: string | null;
  readonly sessionEndedAtIso: string | null;
  readonly overduePendingActionsAvailable: boolean;
  readonly quizSessionMarketingRef: string | null;
};

export type VerifiedGuestBooking = {
  readonly bookingId: string;
  readonly booking: BookingDocument & { _id: ObjectId };
  readonly lead: LeadDocument & { _id: ObjectId };
};

const NOT_FOUND: unique symbol = Symbol('not_found');

export type ResolveGuestBookingResult = VerifiedGuestBooking | typeof NOT_FOUND;

export function isGuestBookingNotFound(result: ResolveGuestBookingResult): result is typeof NOT_FOUND {
  return result === NOT_FOUND;
}

/**
 * Resolves a booking when reference, email, and phone last four match the stored lead.
 * Returns a single sentinel for any mismatch to avoid leaking which field failed.
 */
export async function resolveGuestBookingByCredentials(
  credentials: GuestBookingManageCredentials,
): Promise<ResolveGuestBookingResult> {
  if (!process.env.MONGODB_URI) {
    return NOT_FOUND;
  }
  const bookingReference = normalizeBookingReferenceInput(credentials.bookingReference);
  if (bookingReference.length < 4) {
    return NOT_FOUND;
  }
  const email = normalizeGuestManageEmail(credentials.email);
  if (email.length === 0) {
    return NOT_FOUND;
  }
  const phoneLastFour = credentials.phoneLastFour.trim();
  if (!/^\d{4}$/.test(phoneLastFour)) {
    return NOT_FOUND;
  }
  const escapedReference = bookingReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const db = await getDb();
  const bookingDocs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({
      $expr: {
        $regexMatch: {
          input: { $toString: '$_id' },
          regex: `${escapedReference}$`,
          options: 'i',
        },
      },
    })
    .limit(20)
    .toArray();
  for (const bookingDoc of bookingDocs) {
    if (bookingDoc._id === undefined || bookingDoc.leadId === undefined) {
      continue;
    }
    const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: bookingDoc.leadId });
    if (leadDoc === null) {
      continue;
    }
    const paymentTransactionIdRaw = bookingDoc.paymentTransactionId;
    const transaction =
      paymentTransactionIdRaw !== null && paymentTransactionIdRaw !== undefined
        ? await findPaymentTransactionById(paymentTransactionIdRaw.toString())
        : null;
    const contactMatches = matchesGuestManageContact({
      email,
      phoneLastFour,
      leadEmail: leadDoc.email,
      leadPhone: leadDoc.phone,
      transactionEmail: transaction?.customerEmail ?? null,
      transactionPhone: transaction?.customerPhone ?? null,
    });
    if (!contactMatches) {
      continue;
    }
    return {
      bookingId: bookingDoc._id.toString(),
      booking: bookingDoc as BookingDocument & { _id: ObjectId },
      lead: leadDoc as LeadDocument & { _id: ObjectId },
    };
  }
  return NOT_FOUND;
}

async function reloadLeadForVerified(verified: VerifiedGuestBooking): Promise<LeadDocument & { _id: ObjectId }> {
  const db = await getDb();
  const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: verified.lead._id });
  if (leadDoc === null || leadDoc._id === undefined) {
    return verified.lead;
  }
  return leadDoc as LeadDocument & { _id: ObjectId };
}

async function resolveManageBookingPayability(
  verified: VerifiedGuestBooking,
  publicSettings: Awaited<ReturnType<typeof getPaymentSettingsPublicView>>,
  options?: { readonly expectedVisitorId?: string | null; readonly manageKind?: 'account' | 'guest' },
): Promise<{
  readonly lead: LeadDocument & { _id: ObjectId };
  readonly payability: ReturnType<typeof evaluateBookingPayability>;
  readonly profileSyncAvailable: boolean;
}> {
  const manageKind = options?.manageKind ?? 'guest';
  let lead = verified.lead;
  let accountProfileCanSync = false;
  if (manageKind === 'account' && isAccountVisitorId(verified.booking.visitorId)) {
    const userIdMatch = /^acct:([a-f0-9]{24})$/i.exec(verified.booking.visitorId);
    const user =
      userIdMatch?.[1] !== undefined ? await findUserById(new ObjectId(userIdMatch[1])) : null;
    accountProfileCanSync = buildMarketingLeadContactFromAccountUser(user) !== null;
    if (accountProfileCanSync && leadNeedsProfileSync(lead)) {
      await syncAccountProfileToVisitorLeads(verified.booking.visitorId, { leadId: lead._id });
      lead = await reloadLeadForVerified({ ...verified, lead });
    }
  }
  const payability = evaluateBookingPayability({
    bookingId: verified.bookingId,
    booking: verified.booking,
    lead,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
    expectedVisitorId: options?.expectedVisitorId,
  });
  const profileSyncAvailable =
    manageKind === 'account' &&
    accountProfileCanSync &&
    !payability.canPayOnline &&
    (leadNeedsProfileSync(lead) || payability.code === 'lead_email_missing');
  return { lead, payability, profileSyncAvailable };
}

async function reloadVerifiedBookingAfterPaymentWindowSync(
  verified: VerifiedGuestBooking,
): Promise<VerifiedGuestBooking> {
  await syncBookingIfPaymentWindowExpired(verified.bookingId);
  const db = await getDb();
  const doc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: verified.booking._id });
  if (doc === null || doc._id === undefined) {
    return verified;
  }
  return {
    bookingId: verified.bookingId,
    booking: doc as BookingDocument & { _id: ObjectId },
    lead: verified.lead,
  };
}

export async function buildGuestBookingManageView(
  verified: VerifiedGuestBooking,
  options?: { readonly expectedVisitorId?: string | null; readonly manageKind?: 'account' | 'guest' },
): Promise<GuestBookingManageView> {
  const activeVerified = await reloadVerifiedBookingAfterPaymentWindowSync(verified);
  const publicSettings = await getPaymentSettingsPublicView();
  const paymentExpiresAt = activeVerified.booking.paymentExpiresAt ?? null;
  const { lead, payability, profileSyncAvailable } = await resolveManageBookingPayability(
    activeVerified,
    publicSettings,
    options,
  );
  const meetingRaw = activeVerified.booking.meetingUrl;
  const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
  const recordingOptIn = activeVerified.booking.recordingOptIn === true;
  const resolvedPricing = await resolveCheckoutAmountCentavos({
    serviceKey: activeVerified.booking.serviceKey,
    bookingId: activeVerified.bookingId,
    recordingOptIn,
  });
  const fathomShareUrl = activeVerified.booking.fathomShareUrl?.trim() ?? '';
  const fathomSummaryRaw = activeVerified.booking.fathomSummary?.trim() ?? '';
  const fathomSummaryPreview =
    recordingOptIn && fathomSummaryRaw.length > 0
      ? fathomSummaryRaw.length > 280
        ? `${fathomSummaryRaw.slice(0, 279)}…`
        : fathomSummaryRaw
      : null;
  const fathomProcessedAt = activeVerified.booking.fathomProcessedAt;
  const sessionEndedAtIso =
    fathomProcessedAt instanceof Date && !Number.isNaN(fathomProcessedAt.getTime())
      ? fathomProcessedAt.toISOString()
      : activeVerified.booking.status === 'completed'
        ? activeVerified.booking.updatedAt.toISOString()
        : null;
  const manageKind = options?.manageKind ?? 'guest';
  const overduePendingActionsAvailable = isOverdueUnpaidPendingBooking({
    status: activeVerified.booking.status,
    startsAt: activeVerified.booking.startsAt,
    paymentStatus: activeVerified.booking.paymentStatus,
  });
  const quizSessionId = activeVerified.booking.quizSessionId;
  const quizSessionMarketingRef =
    overduePendingActionsAvailable && quizSessionId !== undefined && quizSessionId !== null
      ? encodeQuizSessionRefForMarketingUrl(quizSessionId.toString())
      : null;
  const payGuidance = buildBookingPayGuidance({
    payabilityCode: payability.code,
    blockedReason: payability.reason,
    canPayOnline: payability.canPayOnline,
    status: activeVerified.booking.status,
    manageKind,
    profileSyncAvailable,
  });
  return {
    bookingReference: formatBookingReferenceId(activeVerified.bookingId),
    status: activeVerified.booking.status,
    startsAtIso: activeVerified.booking.startsAt.toISOString(),
    timezone: activeVerified.booking.timezone,
    serviceKey: activeVerified.booking.serviceKey,
    meetingUrl,
    customerName: lead.name,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentExpiresAtIso: paymentExpiresAt !== null ? paymentExpiresAt.toISOString() : null,
    canPayOnline: payability.canPayOnline,
    payBlockedReason: payability.reason,
    payGuidance,
    profileSyncAvailable,
    payabilityCode: payability.code,
    checkoutAmountLabel: resolvedPricing.amountLabel,
    paymentsEnabled: publicSettings.paymentsEnabled,
    recordingOptIn,
    fathomNotesUrl: recordingOptIn && fathomShareUrl.length > 0 ? fathomShareUrl : null,
    fathomSummaryPreview,
    sessionEndedAtIso,
    overduePendingActionsAvailable,
    quizSessionMarketingRef,
  };
}

export async function findGuestBookingManageView(
  credentials: GuestBookingManageCredentials,
): Promise<GuestBookingManageView | null> {
  const resolved = await resolveGuestBookingByCredentials(credentials);
  if (isGuestBookingNotFound(resolved)) {
    return null;
  }
  return buildGuestBookingManageView(resolved);
}

/**
 * Resolves a booking when its Mongo id matches and the row belongs to the given marketing visitor id.
 */
export async function resolveBookingOwnedByVisitor(
  bookingId: string,
  visitorId: string,
): Promise<ResolveGuestBookingResult> {
  if (!process.env.MONGODB_URI) {
    return NOT_FOUND;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookingId);
  } catch {
    return NOT_FOUND;
  }
  const db = await getDb();
  const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: objectId });
  if (
    bookingDoc === null ||
    bookingDoc._id === undefined ||
    bookingDoc.leadId === undefined ||
    bookingDoc.visitorId !== visitorId
  ) {
    return NOT_FOUND;
  }
  const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: bookingDoc.leadId });
  if (leadDoc === null || leadDoc._id === undefined) {
    return NOT_FOUND;
  }
  return {
    bookingId: bookingDoc._id.toString(),
    booking: bookingDoc as BookingDocument & { _id: ObjectId },
    lead: leadDoc as LeadDocument & { _id: ObjectId },
  };
}

export async function findGuestBookingManageViewForAccountVisitor(
  bookingId: string,
  visitorId: string,
): Promise<GuestBookingManageView | null> {
  const resolved = await resolveBookingOwnedByVisitor(bookingId, visitorId);
  if (isGuestBookingNotFound(resolved)) {
    return null;
  }
  return buildGuestBookingManageView(resolved, { expectedVisitorId: visitorId, manageKind: 'account' });
}

/**
 * Resolves a confirmed booking owned by the visitor when the id suffix matches the reference input.
 */
export async function resolveBookingOwnedByVisitorViaReference(
  bookingReference: string,
  visitorId: string,
): Promise<ResolveGuestBookingResult> {
  if (!process.env.MONGODB_URI) {
    return NOT_FOUND;
  }
  const normalizedReference = normalizeBookingReferenceInput(bookingReference);
  if (normalizedReference.length < 4) {
    return NOT_FOUND;
  }
  const escapedReference = normalizedReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const db = await getDb();
  const bookingDocs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({
      visitorId,
      $expr: {
        $regexMatch: {
          input: { $toString: '$_id' },
          regex: `${escapedReference}$`,
          options: 'i',
        },
      },
    })
    .limit(5)
    .toArray();
  if (bookingDocs.length !== 1) {
    return NOT_FOUND;
  }
  const bookingDoc = bookingDocs[0]!;
  if (bookingDoc._id === undefined || bookingDoc.leadId === undefined) {
    return NOT_FOUND;
  }
  const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: bookingDoc.leadId });
  if (leadDoc === null || leadDoc._id === undefined) {
    return NOT_FOUND;
  }
  return {
    bookingId: bookingDoc._id.toString(),
    booking: bookingDoc as BookingDocument & { _id: ObjectId },
    lead: leadDoc as LeadDocument & { _id: ObjectId },
  };
}

export async function findGuestBookingManageViewForAccountVisitorByReference(
  bookingReference: string,
  visitorId: string,
): Promise<GuestBookingManageView | null> {
  const resolved = await resolveBookingOwnedByVisitorViaReference(bookingReference, visitorId);
  if (isGuestBookingNotFound(resolved)) {
    return null;
  }
  return buildGuestBookingManageView(resolved, { expectedVisitorId: visitorId, manageKind: 'account' });
}

/**
 * Explains why account manage checkout would reject a booking (for API debug responses).
 */
export async function diagnoseAccountBookingPayability(
  bookingId: string,
  visitorId: string,
): Promise<BookingPayabilityResult> {
  const resolved = await resolveBookingOwnedByVisitor(bookingId, visitorId);
  if (isGuestBookingNotFound(resolved)) {
    const booking = await findBookingById(bookingId);
    if (booking === null) {
      return buildBookingNotFoundPayability({ bookingId, visitorIdExpected: visitorId });
    }
    return buildVisitorMismatchPayability({
      bookingId,
      visitorIdExpected: visitorId,
      visitorIdOnBooking: booking.visitorId,
    });
  }
  const publicSettings = await getPaymentSettingsPublicView();
  return evaluateBookingPayability({
    bookingId: resolved.bookingId,
    booking: resolved.booking,
    lead: resolved.lead,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
    expectedVisitorId: visitorId,
  });
}

/**
 * Explains why guest manage checkout would reject a booking (for API debug responses).
 */
export async function diagnoseGuestBookingPayability(
  credentials: GuestBookingManageCredentials,
): Promise<BookingPayabilityResult> {
  const resolved = await resolveGuestBookingByCredentials(credentials);
  if (isGuestBookingNotFound(resolved)) {
    return buildCredentialsMismatchPayability({
      bookingReference: credentials.bookingReference.trim(),
    });
  }
  const publicSettings = await getPaymentSettingsPublicView();
  return evaluateBookingPayability({
    bookingId: resolved.bookingId,
    booking: resolved.booking,
    lead: resolved.lead,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
  });
}

export type { BookingPayabilityResult };

/**
 * Syncs the signed-in account profile onto the booking lead, then returns an updated manage view.
 */
export type SyncAccountProfileForManagedBookingResult =
  | { readonly ok: true; readonly booking: GuestBookingManageView }
  | { readonly ok: false; readonly code: string; readonly message: string };

export async function syncAccountProfileForManagedBooking(
  bookingId: string,
  accountVisitorId: string,
): Promise<SyncAccountProfileForManagedBookingResult> {
  const resolved = await resolveBookingOwnedByVisitor(bookingId, accountVisitorId);
  if (isGuestBookingNotFound(resolved)) {
    return { ok: false, code: 'booking_not_found', message: 'We could not find that booking for your account.' };
  }
  const syncResult = await syncAccountProfileToVisitorLeads(accountVisitorId, { leadId: resolved.lead._id });
  if (!syncResult.ok) {
    return { ok: false, code: syncResult.code, message: syncResult.message };
  }
  const refreshedLead = await reloadLeadForVerified(resolved);
  const booking = await buildGuestBookingManageView(
    { ...resolved, lead: refreshedLead },
    { expectedVisitorId: accountVisitorId, manageKind: 'account' },
  );
  return { ok: true, booking };
}

export async function findVerifiedAccountBookingForCheckout(
  bookingId: string,
  visitorId: string,
): Promise<VerifiedGuestBooking | null> {
  const resolved = await resolveBookingOwnedByVisitor(bookingId, visitorId);
  if (isGuestBookingNotFound(resolved)) {
    return null;
  }
  const view = await buildGuestBookingManageView(resolved, { expectedVisitorId: visitorId });
  if (!view.canPayOnline) {
    return null;
  }
  const booking = await findBookingById(resolved.bookingId);
  if (booking === null || booking.status !== 'pending') {
    return null;
  }
  return resolved;
}

export async function findVerifiedGuestBookingForCheckout(
  credentials: GuestBookingManageCredentials,
): Promise<VerifiedGuestBooking | null> {
  const resolved = await resolveGuestBookingByCredentials(credentials);
  if (isGuestBookingNotFound(resolved)) {
    return null;
  }
  const view = await buildGuestBookingManageView(resolved);
  if (!view.canPayOnline) {
    return null;
  }
  const booking = await findBookingById(resolved.bookingId);
  if (booking === null || booking.status !== 'pending') {
    return null;
  }
  return resolved;
}

/**
 * Resolves a pending payable booking linked to a quiz session for the same marketing visitor.
 */
export async function findVerifiedQuizSessionPendingBookingForCheckout(
  visitorId: string,
  quizSessionId: ObjectId,
): Promise<VerifiedGuestBooking | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    { quizSessionId, visitorId, status: 'pending' },
    { sort: { createdAt: 1 } },
  );
  if (bookingDoc === null || bookingDoc._id === undefined || bookingDoc.leadId === undefined) {
    return null;
  }
  const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: bookingDoc.leadId });
  if (leadDoc === null || leadDoc._id === undefined) {
    return null;
  }
  const verified: VerifiedGuestBooking = {
    bookingId: bookingDoc._id.toString(),
    booking: bookingDoc as BookingDocument & { _id: ObjectId },
    lead: leadDoc as LeadDocument & { _id: ObjectId },
  };
  const view = await buildGuestBookingManageView(verified, { expectedVisitorId: visitorId });
  if (!view.canPayOnline) {
    return null;
  }
  return verified;
}

/**
 * When a quiz session already has a booking that cannot pay online, returns the payability diagnosis.
 */
export async function diagnoseQuizSessionExistingBookingPayability(
  visitorId: string,
  quizSessionId: ObjectId,
): Promise<BookingPayabilityResult | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    { quizSessionId, visitorId },
    { sort: { createdAt: 1 } },
  );
  if (bookingDoc === null || bookingDoc._id === undefined) {
    return null;
  }
  const leadDoc =
    bookingDoc.leadId !== undefined
      ? await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: bookingDoc.leadId })
      : null;
  const publicSettings = await getPaymentSettingsPublicView();
  return evaluateBookingPayability({
    bookingId: bookingDoc._id.toString(),
    booking: bookingDoc,
    lead: leadDoc,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
    expectedVisitorId: visitorId,
  });
}
