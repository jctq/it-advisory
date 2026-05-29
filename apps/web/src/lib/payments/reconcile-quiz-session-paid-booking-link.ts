import { ObjectId } from 'mongodb';
import { findPrimaryBookingSlotByQuizSessionId, linkQuizSessionToVisitorBooking } from '@/lib/data/bookings';
import { findLatestPaymentTransactionByQuizSessionIdHex } from '@/lib/data/payment-transactions';
import { ensurePaidTransactionFulfilled } from '@/lib/payments/payment-completion';

/**
 * When checkout payment succeeded but the booking row was deduped without `quizSessionId`, link the paid
 * transaction's booking back to this diagnostic session.
 */
export async function reconcileQuizSessionPaidBookingLink(input: {
  readonly quizSessionIdHex: string;
  readonly visitorId: string;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const sessionHex = input.quizSessionIdHex.trim();
  if (sessionHex.length === 0) {
    return false;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionHex);
  } catch {
    return false;
  }
  const existingLinked = await findPrimaryBookingSlotByQuizSessionId(objectId);
  if (existingLinked !== null) {
    return false;
  }
  const transaction = await findLatestPaymentTransactionByQuizSessionIdHex(sessionHex);
  if (transaction === null) {
    return false;
  }
  const fulfilled = await ensurePaidTransactionFulfilled(transaction);
  if (fulfilled.status !== 'paid' || fulfilled.bookingId === null) {
    return false;
  }
  return linkQuizSessionToVisitorBooking({
    bookingId: new ObjectId(fulfilled.bookingId),
    visitorId: input.visitorId,
    quizSessionIdHex: sessionHex,
  });
}
