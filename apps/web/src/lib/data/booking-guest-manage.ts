import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentPolicy } from '@/domain/payment-types';
import type { BookingDocument, LeadDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
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
  readonly customerName: string;
  readonly paymentPolicy: PaymentPolicy;
  readonly paymentExpiresAtIso: string | null;
  readonly canPayOnline: boolean;
  readonly payBlockedReason: string | null;
  readonly checkoutAmountLabel: string;
  readonly paymentsEnabled: boolean;
};

type VerifiedGuestBooking = {
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
  return {
    bookingReference: formatBookingReferenceId(verified.bookingId),
    status: verified.booking.status,
    startsAtIso: verified.booking.startsAt.toISOString(),
    timezone: verified.booking.timezone,
    customerName: verified.lead.name,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentExpiresAtIso: paymentExpiresAt !== null ? paymentExpiresAt.toISOString() : null,
    canPayOnline: verified.booking.status === 'pending' && payBlockedReason === null,
    payBlockedReason,
    checkoutAmountLabel: publicSettings.checkoutAmountLabel,
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
