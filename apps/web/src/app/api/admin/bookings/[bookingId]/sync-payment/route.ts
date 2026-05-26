import { NextResponse } from 'next/server';
import { findBookingById } from '@/lib/data/bookings';
import { reconcilePaymentTransactionById } from '@/lib/payments/reconcile-visitor-payments';

type RouteContext = {
  readonly params: Promise<{ readonly bookingId: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { bookingId } = await context.params;
  const booking = await findBookingById(bookingId);
  if (booking === null) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }
  const transactionId = booking.paymentTransactionId?.trim() ?? '';
  if (transactionId.length === 0) {
    return NextResponse.json({ error: 'No payment transaction linked to this booking.' }, { status: 404 });
  }
  const transaction = await reconcilePaymentTransactionById(transactionId);
  if (transaction === null) {
    return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    transactionId: transaction.id,
    status: transaction.status,
    bookingId: transaction.bookingId,
  });
}
