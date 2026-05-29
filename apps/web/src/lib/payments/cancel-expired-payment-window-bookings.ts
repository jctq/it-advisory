import { ObjectId } from 'mongodb';
import type { Filter } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import {
  applyPaymentStatusToBooking,
  resetBookingAfterExpiredPaymentHold,
} from '@/lib/payments/payment-completion';
import { getDb } from '@/lib/mongodb';

const EXPIRED_PAYMENT_WINDOW_FILTER = (now: Date): Filter<BookingDocument> => ({
  status: 'pending',
  paymentExpiresAt: { $lte: now, $ne: null },
  $or: [
    { paymentStatus: { $exists: false } },
    { paymentStatus: null },
    { paymentStatus: { $ne: 'paid' } },
  ],
});

async function syncPendingBookingForExpiredPaymentWindow(
  booking: BookingDocument & { readonly _id: ObjectId },
): Promise<boolean> {
  const paymentTransactionId = booking.paymentTransactionId;
  if (paymentTransactionId !== undefined && paymentTransactionId !== null) {
    const transaction = await findPaymentTransactionById(paymentTransactionId.toString());
    if (
      transaction !== null &&
      (transaction.status === 'pending' || transaction.status === 'processing')
    ) {
      await applyPaymentStatusToBooking({
        transaction,
        nextStatus: 'expired',
        expiredBookingDisposition: 'retain_pending',
      });
      return true;
    }
  }
  await resetBookingAfterExpiredPaymentHold(booking._id);
  return true;
}

export type CancelExpiredPaymentWindowBookingsInput = {
  readonly now?: Date;
  readonly visitorId?: string;
  readonly bookingId?: string;
};

/**
 * Expires unpaid checkout holds whose window has passed and keeps bookings in pending status for rebook flows.
 */
export async function cancelExpiredPaymentWindowBookings(
  input: CancelExpiredPaymentWindowBookingsInput = {},
): Promise<number> {
  if (!process.env.MONGODB_URI) {
    return 0;
  }
  const now = input.now ?? new Date();
  const filter: Filter<BookingDocument> = {
    ...EXPIRED_PAYMENT_WINDOW_FILTER(now),
  };
  if (input.visitorId !== undefined && input.visitorId.trim().length > 0) {
    filter.visitorId = input.visitorId.trim();
  }
  if (input.bookingId !== undefined && input.bookingId.trim().length > 0) {
    try {
      filter._id = new ObjectId(input.bookingId.trim());
    } catch {
      return 0;
    }
  }
  const db = await getDb();
  const docs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find(filter)
    .limit(200)
    .toArray();
  let count = 0;
  for (const doc of docs) {
    if (doc._id === undefined) {
      continue;
    }
    const synced = await syncPendingBookingForExpiredPaymentWindow(
      doc as BookingDocument & { _id: ObjectId },
    );
    if (synced) {
      count += 1;
    }
  }
  return count;
}

/**
 * When a single booking is loaded for manage/checkout, sync status if the payment window already expired.
 */
export async function syncBookingIfPaymentWindowExpired(bookingId: string): Promise<void> {
  await cancelExpiredPaymentWindowBookings({ bookingId });
}
