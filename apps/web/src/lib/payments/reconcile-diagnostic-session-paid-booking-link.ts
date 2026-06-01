import { ObjectId } from 'mongodb';
import { findPrimaryBookingSlotByDiagnosticSessionId, linkDiagnosticSessionToVisitorBooking } from '@/lib/data/bookings';
import { findLatestPaymentTransactionByDiagnosticSessionIdHex } from '@/lib/data/payment-transactions';
import { ensurePaidTransactionFulfilled } from '@/lib/payments/payment-completion';

/**
 * When checkout payment succeeded but the booking row was deduped without `diagnosticSessionId`, link the paid
 * transaction's booking back to this diagnostic session.
 */
export async function reconcileDiagnosticSessionPaidBookingLink(input: {
  readonly diagnosticSessionIdHex: string;
  readonly visitorId: string;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const sessionHex = input.diagnosticSessionIdHex.trim();
  if (sessionHex.length === 0) {
    return false;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionHex);
  } catch {
    return false;
  }
  const existingLinked = await findPrimaryBookingSlotByDiagnosticSessionId(objectId);
  if (existingLinked !== null) {
    return false;
  }
  const transaction = await findLatestPaymentTransactionByDiagnosticSessionIdHex(sessionHex);
  if (transaction === null) {
    return false;
  }
  const fulfilled = await ensurePaidTransactionFulfilled(transaction);
  if (fulfilled.status !== 'paid' || fulfilled.bookingId === null) {
    return false;
  }
  return linkDiagnosticSessionToVisitorBooking({
    bookingId: new ObjectId(fulfilled.bookingId),
    visitorId: input.visitorId,
    diagnosticSessionIdHex: sessionHex,
  });
}
