import { NextResponse } from 'next/server';
import { markBookingPaidByAdmin } from '@/lib/payments/payment-completion';
import { rejectUnlessAdminSession } from '@/lib/server/require-admin-session';

type RouteContext = {
  readonly params: Promise<{ readonly bookingId: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const adminDenied = await rejectUnlessAdminSession(_request);
  if (adminDenied !== null) {
    return adminDenied;
  }
  const { bookingId } = await context.params;
  const ok = await markBookingPaidByAdmin(bookingId);
  if (!ok) {
    return NextResponse.json({ error: 'Booking not found or not pending.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
