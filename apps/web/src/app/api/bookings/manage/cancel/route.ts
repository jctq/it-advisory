import { NextResponse } from 'next/server';
import { guestBookingCancellationSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { requestGuestBookingCancellation } from '@/lib/booking/request-booking-cancellation';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';

function resolveHttpStatus(code: string): number {
  if (code === 'booking_not_found') {
    return 404;
  }
  if (code === 'server_error') {
    return 500;
  }
  return 400;
}

export async function POST(request: Request): Promise<NextResponse> {
  const disabledResponse = await assertManageBookingEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = guestBookingCancellationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await requestGuestBookingCancellation({
    credentials: {
      bookingReference: parsed.data.bookingReference,
      email: parsed.data.email,
      phoneLastFour: parsed.data.phoneLastFour,
    },
    confirmReference: parsed.data.confirmReference,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: resolveHttpStatus(result.code) });
  }
  return NextResponse.json({
    ok: true,
    bookingId: result.bookingId,
    mode: result.mode,
    refundId: result.refundId,
  });
}
