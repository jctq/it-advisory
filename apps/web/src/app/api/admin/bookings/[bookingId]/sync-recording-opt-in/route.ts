import { NextResponse } from 'next/server';
import { syncBookingRecordingOptInFromPaymentTransaction } from '@/lib/booking/sync-booking-recording-from-payment';

type RouteContext = {
  readonly params: Promise<{ readonly bookingId: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { bookingId } = await context.params;
  const result = await syncBookingRecordingOptInFromPaymentTransaction(bookingId);
  if (!result.ok) {
    const status =
      result.reason === 'booking_not_found' ? 404 : result.reason === 'no_transaction' ? 400 : 404;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
