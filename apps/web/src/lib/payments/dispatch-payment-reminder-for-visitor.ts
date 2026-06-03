import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';

/**
 * Sends the "complete your payment" reminder after the customer commits to Pay (not during prepare pre-warm).
 */
export async function dispatchPaymentReminderForVisitor(input: {
  readonly transactionId: string;
  readonly visitorId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: 'transaction_not_found' }> {
  const transaction = await findPaymentTransactionById(input.transactionId.trim());
  if (transaction === null || transaction.visitorId !== input.visitorId) {
    return { ok: false, code: 'transaction_not_found' };
  }
  await executeSendBookingPaymentReminderEmail({ transaction });
  return { ok: true };
}
