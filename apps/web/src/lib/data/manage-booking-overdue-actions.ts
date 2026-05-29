import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import {
  buildGuestBookingManageView,
  type VerifiedGuestBooking,
} from '@/lib/data/booking-guest-manage';
import { isMarketingSlotInPublishedAvailability } from '@/lib/data/booking-availability';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { deleteQuizSessionForVisitor } from '@/lib/data/quiz-sessions';
import { cancelActiveBookingAndPaymentHold } from '@/lib/payments/release-quiz-session-slot-reservations';
import { isOverdueUnpaidPendingBooking } from '@/lib/marketing/overdue-pending-booking';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { getDb } from '@/lib/mongodb';

export type ManageBookingOverdueActionResult =
  | { readonly ok: true; readonly booking: Awaited<ReturnType<typeof buildGuestBookingManageView>> }
  | { readonly ok: false; readonly code: string; readonly message: string };

function assertOverdueUnpaidPending(booking: BookingDocument): ManageBookingOverdueActionResult | null {
  if (
    !isOverdueUnpaidPendingBooking({
      status: booking.status,
      startsAt: booking.startsAt,
      paymentStatus: booking.paymentStatus,
    })
  ) {
    return {
      ok: false,
      code: 'not_overdue_pending',
      message: 'This action is only available for unpaid bookings whose session time has passed.',
    };
  }
  return null;
}

async function hasOtherActiveBookingAtSlot(input: {
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
  readonly excludeBookingId: ObjectId;
}): Promise<boolean> {
  const db = await getDb();
  const count = await db.collection<BookingDocument>(COLLECTIONS.bookings).countDocuments({
    serviceKey: input.serviceKey,
    status: { $in: ['pending', 'confirmed'] },
    startsAt: input.startsAtUtc,
    _id: { $ne: input.excludeBookingId },
  });
  return count > 0;
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
  const publicSettings = await getPaymentSettingsPublicView();
  const paymentExpiresAt = new Date(Date.now() + publicSettings.holdExpiresMinutes * 60_000);
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: verified.booking._id },
    {
      $set: {
        startsAt: startsAtUtc,
        timezone: PRIMARY_TIMEZONE,
        paymentExpiresAt,
        updatedAt: new Date(),
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
  const quizSessionId = verified.booking.quizSessionId;
  if (quizSessionId !== undefined && quizSessionId !== null) {
    const outcome = await deleteQuizSessionForVisitor(
      verified.booking.visitorId,
      quizSessionId.toString(),
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
