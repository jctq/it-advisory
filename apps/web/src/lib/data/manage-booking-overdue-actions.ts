import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import {
  buildGuestBookingManageView,
  type VerifiedGuestBooking,
} from '@/lib/data/booking-guest-manage';
import {
  isMarketingSlotInPublishedAvailability,
  isMarketingSlotInPublishedAvailabilityForCheckout,
} from '@/lib/data/booking-availability';
import { isCheckoutSlotInstantOccupiedExcludingSession } from '@/lib/data/advisor-booking-settings';
import { isReleasedBookingSlotStartsAt } from '@/lib/booking/pending-payment-expired-for-rebook';
import { deleteDiagnosticSessionForVisitor } from '@/lib/data/diagnostic-sessions';
import { cancelActiveBookingAndPaymentHold } from '@/lib/payments/release-diagnostic-session-slot-reservations';
import { isPendingPaymentExpiredForRebook } from '@/lib/booking/pending-payment-expired-for-rebook';
import { isOverdueUnpaidPendingBooking } from '@/lib/marketing/overdue-pending-booking';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { getDb } from '@/lib/mongodb';

export type ManageBookingOverdueActionResult =
  | { readonly ok: true; readonly booking: Awaited<ReturnType<typeof buildGuestBookingManageView>> }
  | { readonly ok: false; readonly code: string; readonly message: string };

function assertOverdueUnpaidPending(booking: BookingDocument): ManageBookingOverdueActionResult | null {
  const canRebook =
    isPendingPaymentExpiredForRebook({
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentExpiresAt: booking.paymentExpiresAt,
      startsAt: booking.startsAt,
    }) ||
    isOverdueUnpaidPendingBooking({
      status: booking.status,
      startsAt: booking.startsAt,
      paymentStatus: booking.paymentStatus,
    });
  if (!canRebook) {
    return {
      ok: false,
      code: 'not_overdue_pending',
      message: 'This action is only available for unpaid bookings that need a new session time.',
    };
  }
  return null;
}

async function hasOtherActiveBookingAtSlot(input: {
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
  readonly excludeBookingId: ObjectId;
  readonly excludeDiagnosticSessionIdHex?: string | null;
}): Promise<boolean> {
  const excludeSessionHex = input.excludeDiagnosticSessionIdHex?.trim() ?? '';
  if (excludeSessionHex.length > 0) {
    return isCheckoutSlotInstantOccupiedExcludingSession({
      startsAtUtc: input.startsAtUtc,
      excludeDiagnosticSessionIdHex: excludeSessionHex,
    });
  }
  const db = await getDb();
  const count = await db.collection<BookingDocument>(COLLECTIONS.bookings).countDocuments({
    serviceKey: input.serviceKey,
    status: { $in: ['pending', 'confirmed'] },
    paymentStatus: { $ne: 'expired' },
    startsAt: input.startsAtUtc,
    _id: { $ne: input.excludeBookingId },
  });
  return count > 0;
}

function doesBookingMatchSlot(
  booking: BookingDocument,
  input: { readonly dateYmd: string; readonly timeLabel: string },
): boolean {
  if (isReleasedBookingSlotStartsAt(booking.startsAt)) {
    return false;
  }
  try {
    const expectedStartsAtUtc = parseBookingSlotToUtc(input.dateYmd, input.timeLabel);
    return booking.startsAt.getTime() === expectedStartsAtUtc.getTime();
  } catch {
    return false;
  }
}

async function applyPendingBookingSlotUpdate(
  verified: VerifiedGuestBooking,
  startsAtUtc: Date,
  options?: { readonly expectedVisitorId?: string | null; readonly manageKind?: 'account' | 'guest' },
): Promise<ManageBookingOverdueActionResult> {
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: verified.booking._id },
    {
      $set: {
        startsAt: startsAtUtc,
        timezone: PRIMARY_TIMEZONE,
        updatedAt: new Date(),
      },
      $unset: {
        paymentStatus: '',
        paymentTransactionId: '',
        paymentExpiresAt: '',
        meetingUrl: '',
        zoomMeetingId: '',
        googleMeetEventId: '',
        teamsOnlineMeetingId: '',
      },
    },
  );
  const refreshedBooking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: verified.booking._id });
  if (refreshedBooking === null || refreshedBooking._id === undefined) {
    return { ok: false, code: 'booking_not_found', message: 'Booking could not be updated.' };
  }
  const booking = await buildGuestBookingManageView(
    {
      bookingId: verified.bookingId,
      booking: refreshedBooking as BookingDocument & { _id: ObjectId },
      lead: verified.lead,
    },
    options,
  );
  return { ok: true, booking };
}

function bookingNeedsCheckoutSlotRefresh(booking: BookingDocument): boolean {
  return (
    isPendingPaymentExpiredForRebook({
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentExpiresAt: booking.paymentExpiresAt,
      startsAt: booking.startsAt,
    }) ||
    booking.paymentStatus === 'expired' ||
    isReleasedBookingSlotStartsAt(booking.startsAt)
  );
}

/**
 * Applies a checkout slot for a pending diagnostic booking, excluding the session's own stale reservation.
 */
export async function reschedulePendingBookingSlotForCheckout(
  verified: VerifiedGuestBooking,
  input: {
    readonly dateYmd: string;
    readonly timeLabel: string;
    readonly diagnosticSessionIdHex: string;
    readonly visitorId?: string | null;
  },
  options?: { readonly expectedVisitorId?: string | null },
): Promise<ManageBookingOverdueActionResult> {
  if (verified.booking.status !== 'pending') {
    return { ok: false, code: 'not_pending', message: 'This booking cannot be updated.' };
  }
  if (verified.booking.paymentStatus === 'paid') {
    return { ok: false, code: 'already_paid', message: 'This booking is already paid.' };
  }
  let startsAtUtc: Date;
  try {
    startsAtUtc = parseBookingSlotToUtc(input.dateYmd, input.timeLabel);
  } catch {
    return { ok: false, code: 'invalid_slot', message: 'Invalid date or time.' };
  }
  if (startsAtUtc.getTime() <= Date.now()) {
    return { ok: false, code: 'slot_in_past', message: 'Choose a future date and time.' };
  }
  const slotMatches = doesBookingMatchSlot(verified.booking, input);
  if (slotMatches && !bookingNeedsCheckoutSlotRefresh(verified.booking)) {
    const booking = await buildGuestBookingManageView(
      {
        bookingId: verified.bookingId,
        booking: verified.booking as BookingDocument & { _id: ObjectId },
        lead: verified.lead,
      },
      options,
    );
    return { ok: true, booking };
  }
  const slotAvailable = await isMarketingSlotInPublishedAvailabilityForCheckout({
    serviceKey: verified.booking.serviceKey,
    startsAtUtc,
    diagnosticSessionIdHex: input.diagnosticSessionIdHex,
    visitorId: input.visitorId ?? verified.booking.visitorId,
  });
  if (!slotAvailable) {
    return { ok: false, code: 'slot_unavailable', message: 'This time is no longer available.' };
  }
  return applyPendingBookingSlotUpdate(verified, startsAtUtc, options);
}

/**
 * Moves a past-due unpaid pending booking to a new published slot and refreshes the payment hold window.
 */
export async function rescheduleOverduePendingBooking(
  verified: VerifiedGuestBooking,
  input: { readonly dateYmd: string; readonly timeLabel: string },
  options?: { readonly expectedVisitorId?: string | null; readonly manageKind?: 'account' | 'guest' },
): Promise<ManageBookingOverdueActionResult> {
  const blocked = assertOverdueUnpaidPending(verified.booking);
  if (blocked !== null) {
    return blocked;
  }
  let startsAtUtc: Date;
  try {
    startsAtUtc = parseBookingSlotToUtc(input.dateYmd, input.timeLabel);
  } catch {
    return { ok: false, code: 'invalid_slot', message: 'Invalid date or time.' };
  }
  if (startsAtUtc.getTime() <= Date.now()) {
    return { ok: false, code: 'slot_in_past', message: 'Choose a future date and time.' };
  }
  const slotAvailable = await isMarketingSlotInPublishedAvailability({
    serviceKey: verified.booking.serviceKey,
    startsAtUtc,
  });
  if (!slotAvailable) {
    return { ok: false, code: 'slot_unavailable', message: 'That time is no longer available. Pick another slot.' };
  }
  if (await hasOtherActiveBookingAtSlot({
    serviceKey: verified.booking.serviceKey,
    startsAtUtc,
    excludeBookingId: verified.booking._id,
  })) {
    return { ok: false, code: 'slot_taken', message: 'That time was just taken. Pick another slot.' };
  }
  return applyPendingBookingSlotUpdate(verified, startsAtUtc, options);
}

/**
 * Cancels a past-due unpaid booking and removes its linked diagnostic session when present.
 */
export async function abandonOverduePendingBooking(
  verified: VerifiedGuestBooking,
  options?: { readonly expectedVisitorId?: string | null; readonly manageKind?: 'account' | 'guest' },
): Promise<ManageBookingOverdueActionResult> {
  const blocked = assertOverdueUnpaidPending(verified.booking);
  if (blocked !== null) {
    return blocked;
  }
  const db = await getDb();
  const diagnosticSessionId = verified.booking.diagnosticSessionId;
  if (diagnosticSessionId !== undefined && diagnosticSessionId !== null) {
    const outcome = await deleteDiagnosticSessionForVisitor(
      verified.booking.visitorId,
      diagnosticSessionId.toString(),
    );
    if (outcome.ok === false) {
      return { ok: false, code: 'session_not_found', message: 'Diagnostic could not be removed.' };
    }
  } else {
    await cancelActiveBookingAndPaymentHold(verified.booking._id);
  }
  const refreshedBooking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: verified.booking._id });
  if (refreshedBooking === null || refreshedBooking._id === undefined) {
    return { ok: false, code: 'booking_not_found', message: 'Booking could not be updated.' };
  }
  const booking = await buildGuestBookingManageView(
    {
      bookingId: verified.bookingId,
      booking: refreshedBooking as BookingDocument & { _id: ObjectId },
      lead: verified.lead,
    },
    options,
  );
  return { ok: true, booking };
}
