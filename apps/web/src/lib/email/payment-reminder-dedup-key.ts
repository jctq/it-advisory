import type { PaymentTransactionRow } from '@/lib/data/payment-transactions';

export function buildPaymentReminderDedupKey(input: {
  readonly bookingId: string | null;
  readonly transaction: PaymentTransactionRow;
}): string {
  if (input.bookingId !== null) {
    return `booking:${input.bookingId}`;
  }
  const quizSessionIdHex = input.transaction.quizSessionIdHex?.trim() ?? 'none';
  return `checkout:${input.transaction.visitorId}:${quizSessionIdHex}:${input.transaction.serviceKey}:${input.transaction.startsAtIso}`;
}
