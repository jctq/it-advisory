import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';

/** True when the guest must still complete an online payment to confirm the booking. */
export function isSessionAwaitingPayment(row: VisitorQuizSessionSummary): boolean {
  if (row.bookingStatus === 'confirmed' || row.paymentTransactionStatus === 'paid') {
    return false;
  }
  if (row.paymentTransactionStatus === 'pending') {
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
