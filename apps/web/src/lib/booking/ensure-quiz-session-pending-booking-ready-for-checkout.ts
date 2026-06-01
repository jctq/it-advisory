import type { ObjectId } from 'mongodb';
import {
  buildGuestBookingManageView,
  findQuizSessionPendingBookingRecord,
  type VerifiedGuestBooking,
} from '@/lib/data/booking-guest-manage';
import { rescheduleOverduePendingBooking } from '@/lib/data/manage-booking-overdue-actions';
import type { BookingDocument } from '@/domain/types';
import { isPendingPaymentExpiredForRebook, isReleasedBookingSlotStartsAt } from '@/lib/booking/pending-payment-expired-for-rebook';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';

function pendingBookingNeedsSlotRebook(booking: BookingDocument): boolean {
  return (
    isPendingPaymentExpiredForRebook({
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentExpiresAt: booking.paymentExpiresAt,
      startsAt: booking.startsAt,
    }) || isReleasedBookingSlotStartsAt(booking.startsAt)
  );
}

function doesBookingMatchCheckoutSlot(
  booking: BookingDocument,
  slot: { readonly dateYmd: string; readonly timeLabel: string },
): boolean {
  if (isReleasedBookingSlotStartsAt(booking.startsAt)) {
    return false;
  }
  try {
    const expectedStartsAtUtc = parseBookingSlotToUtc(slot.dateYmd, slot.timeLabel);
    return booking.startsAt.getTime() === expectedStartsAtUtc.getTime();
  } catch {
    return false;
  }
}

export type EnsureQuizSessionPendingBookingReadyResult =
  | { readonly ok: true; readonly verified: VerifiedGuestBooking }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Applies a new slot to a stale pending booking (expired hold / released slot) before checkout.
 */
export async function ensureQuizSessionPendingBookingReadyForCheckout(
  visitorId: string,
  quizSessionId: ObjectId,
  slot: { readonly dateYmd: string; readonly timeLabel: string },
  options?: { readonly requirePayable?: boolean },
): Promise<EnsureQuizSessionPendingBookingReadyResult> {
  const requirePayable = options?.requirePayable ?? true;
  let verified = await findQuizSessionPendingBookingRecord(visitorId, quizSessionId);
  if (verified === null) {
    return { ok: false, code: 'booking_not_found', message: 'Pending booking not found.' };
  }
  const needsSlotUpdate =
    pendingBookingNeedsSlotRebook(verified.booking) || !doesBookingMatchCheckoutSlot(verified.booking, slot);
  if (needsSlotUpdate) {
    const rescheduled = await rescheduleOverduePendingBooking(verified, slot, {
      expectedVisitorId: visitorId,
    });
    if (!rescheduled.ok) {
      return { ok: false, code: rescheduled.code, message: rescheduled.message };
    }
    verified = await findQuizSessionPendingBookingRecord(visitorId, quizSessionId);
    if (verified === null) {
      return { ok: false, code: 'booking_not_found', message: 'Pending booking not found.' };
    }
  }
  if (!requirePayable) {
    return { ok: true, verified };
  }
  const view = await buildGuestBookingManageView(verified, { expectedVisitorId: visitorId });
  if (!view.canPayOnline) {
    return {
      ok: false,
      code: view.payabilityCode,
      message: view.payBlockedReason ?? 'This booking cannot be paid online.',
    };
  }
  return { ok: true, verified };
}
