import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { findVerifiedGuestBookingForCheckout, type GuestBookingManageCredentials } from '@/lib/data/booking-guest-manage';
import { findVerifiedAccountBookingForCheckout } from '@/lib/data/booking-guest-manage';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';

async function dispatchPaymentReminderForVerifiedBooking(input: {
  readonly expectedBookingId: string;
  readonly transactionId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: 'transaction_not_found' }> {
  const transaction = await findPaymentTransactionById(input.transactionId.trim());
  if (transaction === null) {
    return { ok: false, code: 'transaction_not_found' };
  }
  const linkedBookingId = transaction.bookingId?.trim() ?? '';
  if (linkedBookingId.length === 0 || linkedBookingId !== input.expectedBookingId) {
    return { ok: false, code: 'transaction_not_found' };
  }
  await executeSendBookingPaymentReminderEmail({ transaction });
  return { ok: true };
}

export async function dispatchPaymentReminderForGuestManageCheckout(input: {
  readonly credentials: GuestBookingManageCredentials;
  readonly transactionId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: 'transaction_not_found' }> {
  const verified = await findVerifiedGuestBookingForCheckout(input.credentials);
  if (verified === null) {
    return { ok: false, code: 'transaction_not_found' };
  }
  return dispatchPaymentReminderForVerifiedBooking({
    expectedBookingId: verified.bookingId,
    transactionId: input.transactionId,
  });
}

export async function dispatchPaymentReminderForAccountManageCheckout(input: {
  readonly bookingId: string;
  readonly visitorId: string;
  readonly transactionId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: 'transaction_not_found' }> {
  const verified = await findVerifiedAccountBookingForCheckout(input.bookingId, input.visitorId);
  if (verified === null) {
    return { ok: false, code: 'transaction_not_found' };
  }
  return dispatchPaymentReminderForVerifiedBooking({
    expectedBookingId: verified.bookingId,
    transactionId: input.transactionId,
  });
}
