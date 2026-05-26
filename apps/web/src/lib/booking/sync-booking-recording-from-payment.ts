import { ObjectId } from 'mongodb';
import { findBookingById } from '@/lib/data/bookings';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { syncBookingRecordingFieldsFromTransaction } from '@/lib/booking/apply-booking-recording-fields';

export type SyncBookingRecordingFromPaymentResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'booking_not_found' | 'no_transaction' | 'transaction_not_found' };

export async function syncBookingRecordingOptInFromPaymentTransaction(
  bookingId: string,
): Promise<SyncBookingRecordingFromPaymentResult> {
  const booking = await findBookingById(bookingId);
  if (booking === null) {
    return { ok: false, reason: 'booking_not_found' };
  }
  if (booking.paymentTransactionId === null) {
    return { ok: false, reason: 'no_transaction' };
  }
  const transaction = await findPaymentTransactionById(booking.paymentTransactionId);
  if (transaction === null) {
    return { ok: false, reason: 'transaction_not_found' };
  }
  await syncBookingRecordingFieldsFromTransaction({
    bookingId: new ObjectId(booking.id),
    metadata: transaction.metadata,
  });
  return { ok: true };
}
