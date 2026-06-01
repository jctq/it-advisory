import type { PaymentTransactionRow } from '@/lib/data/payment-transactions';

export function buildPaymentReminderDedupKey(input: {
  readonly bookingId: string | null;
  readonly transaction: PaymentTransactionRow;
}): string {
  if (input.bookingId !== null) {
    return `booking:${input.bookingId}`;
  }
  const diagnosticSessionIdHex = input.transaction.diagnosticSessionIdHex?.trim() ?? 'none';
  return `checkout:${input.transaction.visitorId}:${diagnosticSessionIdHex}:${input.transaction.serviceKey}:${input.transaction.startsAtIso}`;
}
