import { ObjectId } from 'mongodb';
import { findBookingById, findPrimaryBookingSlotByQuizSessionId } from '@/lib/data/bookings';
import { findLatestPaymentTransactionByQuizSessionIdHex } from '@/lib/data/payment-transactions';
import {
  applyPaymentStatusToBooking,
  cancelBookingById,
} from '@/lib/payments/payment-completion';
import { cancelExpiredPaymentWindowBookings } from '@/lib/payments/cancel-expired-payment-window-bookings';

async function expireLatestOpenPaymentTransactionForSession(
  quizSessionIdHex: string,
  now: Date,
): Promise<boolean> {
  const transaction = await findLatestPaymentTransactionByQuizSessionIdHex(quizSessionIdHex);
  if (transaction === null) {
    return false;
  }
  if (transaction.status !== 'pending' && transaction.status !== 'processing') {
    return false;
  }
  const expiresAtIso = transaction.expiresAtIso?.trim() ?? '';
  if (expiresAtIso.length === 0) {
    return false;
  }
  const expiresAtMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs > now.getTime()) {
    return false;
  }
  await applyPaymentStatusToBooking({ transaction, nextStatus: 'expired' });
  return true;
}

async function releaseStalePendingBookingAfterExpiredPayment(input: {
  readonly bookingId: string;
  readonly quizSessionIdHex: string;
  readonly now: Date;
}): Promise<boolean> {
  const booking = await findBookingById(input.bookingId);
  if (booking === null || booking.status !== 'pending') {
    return false;
  }
  const paymentExpiresAtIso = booking.paymentExpiresAtIso?.trim() ?? '';
  const paymentExpiresAtMs =
    paymentExpiresAtIso.length > 0 ? Date.parse(paymentExpiresAtIso) : Number.NaN;
  const paymentWindowClosed =
    Number.isFinite(paymentExpiresAtMs) && paymentExpiresAtMs <= input.now.getTime();
  const latestPayment = await findLatestPaymentTransactionByQuizSessionIdHex(input.quizSessionIdHex);
  const paymentTerminal =
    latestPayment !== null &&
    (latestPayment.status === 'expired' || latestPayment.status === 'failed');
  if (!paymentWindowClosed && !paymentTerminal) {
    return false;
  }
  await cancelBookingById(new ObjectId(input.bookingId));
  return true;
}

export type SyncQuizSessionPaymentHoldResult = {
  readonly cancelled: boolean;
  readonly bookingId: string | null;
};

/**
 * Expires unpaid holds for a quiz session (booking row and/or open checkout transaction) using server time.
 */
export async function syncQuizSessionPaymentHold(input: {
  readonly quizSessionIdHex: string;
  readonly visitorId: string;
  readonly now?: Date;
}): Promise<SyncQuizSessionPaymentHoldResult> {
  const now = input.now ?? new Date();
  let bookingId: string | null = null;
  let cancelled = false;
  const primarySlot = await findPrimaryBookingSlotByQuizSessionId(new ObjectId(input.quizSessionIdHex));
  if (primarySlot !== null) {
    bookingId = primarySlot.bookingId;
    const cancelledCount = await cancelExpiredPaymentWindowBookings({
      now,
      visitorId: input.visitorId,
      bookingId: primarySlot.bookingId,
    });
    if (cancelledCount > 0) {
      cancelled = true;
    } else {
      const booking = await findBookingById(primarySlot.bookingId);
      if (booking !== null && booking.status === 'cancelled') {
        cancelled = true;
      }
    }
  }
  const transactionExpired = await expireLatestOpenPaymentTransactionForSession(input.quizSessionIdHex, now);
  if (transactionExpired) {
    cancelled = true;
  }
  if (bookingId !== null) {
    const released = await releaseStalePendingBookingAfterExpiredPayment({
      bookingId,
      quizSessionIdHex: input.quizSessionIdHex,
      now,
    });
    if (released) {
      cancelled = true;
    }
  }
  return { cancelled, bookingId };
}
