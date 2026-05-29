import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import type { PaymentStatus } from '@/domain/payment-types';
import {
  findOpenPaymentTransactionForBooking,
  listOpenPaymentTransactionsByQuizSessionIdHex,
} from '@/lib/data/payment-transactions';
import { getDb } from '@/lib/mongodb';
import {
  applyPaymentStatusToBooking,
  cancelBookingById,
} from '@/lib/payments/payment-completion';

const ACTIVE_BOOKING_STATUSES: readonly BookingDocument['status'][] = ['pending', 'confirmed'];

const OPEN_PAYMENT_TRANSACTION_STATUSES: readonly PaymentStatus[] = ['pending', 'processing'];

/**
 * Cancels a booking row and expires any open checkout transaction so the slot is no longer reserved.
 */
export async function cancelActiveBookingAndPaymentHold(bookingId: ObjectId): Promise<void> {
  const openTransaction = await findOpenPaymentTransactionForBooking(bookingId.toString());
  if (openTransaction !== null) {
    await applyPaymentStatusToBooking({ transaction: openTransaction, nextStatus: 'expired' });
    return;
  }
  await cancelBookingById(bookingId);
}

async function expireOpenPaymentTransactionsForQuizSession(sessionHex: string): Promise<void> {
  const transactions = await listOpenPaymentTransactionsByQuizSessionIdHex(sessionHex);
  for (const transaction of transactions) {
    if (!OPEN_PAYMENT_TRANSACTION_STATUSES.includes(transaction.status)) {
      continue;
    }
    await applyPaymentStatusToBooking({ transaction, nextStatus: 'expired' });
  }
}

/**
 * Cancels active bookings and open checkout holds linked to a quiz session so the time slot is bookable again.
 */
export async function releaseSlotReservationsForQuizSession(quizSessionId: ObjectId): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  const sessionHex = quizSessionId.toString();
  const db = await getDb();
  const activeBookings = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({
      quizSessionId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
    })
    .toArray();
  for (const booking of activeBookings) {
    if (booking._id === undefined) {
      continue;
    }
    await cancelActiveBookingAndPaymentHold(booking._id);
  }
  await expireOpenPaymentTransactionsForQuizSession(sessionHex);
}
