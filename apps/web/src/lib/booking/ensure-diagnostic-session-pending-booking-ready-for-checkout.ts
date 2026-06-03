import type { ObjectId } from 'mongodb';
import {
  findDiagnosticSessionPendingBookingRecord,
  type VerifiedGuestBooking,
} from '@/lib/data/booking-guest-manage';
import { getPaymentSettings, type PaymentSettingsValues } from '@/lib/data/payment-settings';
import { rescheduleOverduePendingBooking } from '@/lib/data/manage-booking-overdue-actions';
import { syncSingleBookingIfPaymentWindowExpired } from '@/lib/payments/cancel-expired-payment-window-bookings';
import type { BookingDocument } from '@/domain/types';
import { isPendingPaymentExpiredForRebook, isReleasedBookingSlotStartsAt } from '@/lib/booking/pending-payment-expired-for-rebook';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { evaluateBookingPayability } from '@/lib/payments/evaluate-booking-payability';
import { COLLECTIONS } from '@/domain/collections';
import { getDb } from '@/lib/mongodb';

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

export type EnsureDiagnosticSessionPendingBookingReadyResult =
  | { readonly ok: true; readonly verified: VerifiedGuestBooking }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Applies a new slot to a stale pending booking (expired hold / released slot) before checkout.
 */
export async function ensureDiagnosticSessionPendingBookingReadyForCheckout(
  visitorId: string,
  diagnosticSessionId: ObjectId,
  slot: { readonly dateYmd: string; readonly timeLabel: string },
  options?: {
    readonly requirePayable?: boolean;
    readonly paymentSettings?: PaymentSettingsValues;
  },
): Promise<EnsureDiagnosticSessionPendingBookingReadyResult> {
  const requirePayable = options?.requirePayable ?? true;
  let verified = await findDiagnosticSessionPendingBookingRecord(visitorId, diagnosticSessionId);
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
    verified = await findDiagnosticSessionPendingBookingRecord(visitorId, diagnosticSessionId);
    if (verified === null) {
      return { ok: false, code: 'booking_not_found', message: 'Pending booking not found.' };
    }
  }
  if (!requirePayable) {
    return { ok: true, verified };
  }
  const paymentSettings = options?.paymentSettings ?? (await getPaymentSettings());
  const paymentWindowSync = await syncSingleBookingIfPaymentWindowExpired(verified.bookingId, {
    holdExpiresMinutes: paymentSettings.holdExpiresMinutes,
  });
  if (paymentWindowSync.didMutate && process.env.MONGODB_URI) {
    const db = await getDb();
    const refreshedBooking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({
      _id: verified.booking._id,
    });
    if (refreshedBooking !== null && refreshedBooking._id !== undefined) {
      verified = {
        bookingId: verified.bookingId,
        booking: refreshedBooking as BookingDocument & { _id: ObjectId },
        lead: verified.lead,
      };
    }
  }
  const payability = evaluateBookingPayability({
    bookingId: verified.bookingId,
    booking: verified.booking,
    lead: verified.lead,
    paymentPolicy: paymentSettings.paymentPolicy,
    paymentsEnabled: paymentSettings.paymentsEnabled,
    expectedVisitorId: visitorId,
  });
  if (!payability.canPayOnline) {
    return {
      ok: false,
      code: payability.code,
      message: payability.reason ?? 'This booking cannot be paid online.',
    };
  }
  return { ok: true, verified };
}
