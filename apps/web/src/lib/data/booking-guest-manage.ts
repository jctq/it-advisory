import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentPolicy } from '@/domain/payment-types';
import type { BookingDocument, LeadDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';
import {
  formatBookingReferenceId,
  matchesPhoneLastFour,
  normalizeBookingReferenceInput,
  normalizeGuestManageEmail,
} from '@/lib/marketing/booking-reference';
import { getDb } from '@/lib/mongodb';

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
  readonly checkoutAmountLabel: string;
  readonly paymentsEnabled: boolean;
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
    const leadEmail = typeof leadDoc.email === 'string' ? normalizeGuestManageEmail(leadDoc.email) : '';
    if (leadEmail.length === 0 || leadEmail !== email) {
      continue;
    }
    if (!matchesPhoneLastFour(leadDoc.phone, phoneLastFour)) {
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

function resolvePayBlockedReason(input: {
  readonly status: BookingDocument['status'];
  readonly paymentPolicy: PaymentPolicy;
  readonly paymentsEnabled: boolean;
  readonly paymentExpiresAt: Date | null | undefined;
}): string | null {
  if (input.status === 'confirmed') {
    return 'This booking is already confirmed.';
  }
  if (input.status === 'cancelled') {
    return 'This booking was cancelled.';
  }
  if (!input.paymentsEnabled) {
    return 'Online payment is not available right now. Contact us if you need help.';
  }
  if (input.paymentPolicy === 'manual_confirm') {
    return 'Your booking is awaiting manual confirmation. We will email you when it is confirmed.';
  }
  if (input.paymentExpiresAt !== undefined && input.paymentExpiresAt !== null && input.paymentExpiresAt.getTime() <= Date.now()) {
    return 'The payment window for this booking has expired. Contact us to rebook.';
  }
  return null;
}

export async function buildGuestBookingManageView(
  verified: VerifiedGuestBooking,
): Promise<GuestBookingManageView> {
  const publicSettings = await getPaymentSettingsPublicView();
  const paymentExpiresAt = verified.booking.paymentExpiresAt ?? null;
  const payBlockedReason = resolvePayBlockedReason({
    status: verified.booking.status,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
    paymentExpiresAt,
  });
  const meetingRaw = verified.booking.meetingUrl;
  const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
  const resolvedPricing = await resolveCheckoutAmountCentavos({
    serviceKey: verified.booking.serviceKey,
    bookingId: verified.bookingId,
  });
  return {
    bookingReference: formatBookingReferenceId(verified.bookingId),
    status: verified.booking.status,
    startsAtIso: verified.booking.startsAt.toISOString(),
    timezone: verified.booking.timezone,
    serviceKey: verified.booking.serviceKey,
    meetingUrl,
    customerName: verified.lead.name,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentExpiresAtIso: paymentExpiresAt !== null ? paymentExpiresAt.toISOString() : null,
    canPayOnline: verified.booking.status === 'pending' && payBlockedReason === null,
    payBlockedReason,
    checkoutAmountLabel: resolvedPricing.amountLabel,
    paymentsEnabled: publicSettings.paymentsEnabled,
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
  return buildGuestBookingManageView(resolved);
}

export async function findVerifiedAccountBookingForCheckout(
  bookingId: string,
  visitorId: string,
): Promise<VerifiedGuestBooking | null> {
  const resolved = await resolveBookingOwnedByVisitor(bookingId, visitorId);
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
  const view = await buildGuestBookingManageView(verified);
  if (!view.canPayOnline) {
    return null;
  }
  return verified;
}
