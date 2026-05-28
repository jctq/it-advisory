import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';

function isTerminalPaymentStatus(
  status: VisitorQuizSessionSummary['paymentTransactionStatus'],
): boolean {
  return status === 'expired' || status === 'failed';
}

/** True when payment failed or expired — show view + manage booking, not resume checkout. */
export function isSessionPaymentExpiredForManage(row: VisitorQuizSessionSummary): boolean {
  if (isTerminalPaymentStatus(row.paymentTransactionStatus)) {
    return true;
  }
  if (row.bookingStatus === 'cancelled' && row.paymentTransactionStatus !== 'paid') {
    return true;
  }
  return false;
}

/** True when the guest must still complete an online payment to confirm the booking. */
export function isSessionAwaitingPayment(row: VisitorQuizSessionSummary): boolean {
  if (isSessionPaymentExpiredForManage(row)) {
    return false;
  }
  if (row.bookingStatus === 'confirmed' || row.paymentTransactionStatus === 'paid') {
    return false;
  }
  if (row.paymentTransactionStatus === 'pending' || row.paymentTransactionStatus === 'processing') {
    return true;
  }
  if (row.bookingStatus === 'pending') {
    return true;
  }
  return false;
}

/** True when the booking is confirmed or payment has cleared (post-checkout manage flows). */
export function isSessionConfirmedForManage(row: VisitorQuizSessionSummary): boolean {
  return row.bookingStatus === 'confirmed' || row.paymentTransactionStatus === 'paid';
}

/** Marketing checkout path to resume payment for this diagnostic session. */
export function buildSessionAwaitingPaymentBookHref(row: VisitorQuizSessionSummary): string {
  const serviceKey = row.bookingServiceKey ?? row.checkoutServiceKey;
  return buildMarketingBookSessionPath(row.marketingSessionRef, serviceKey);
}
