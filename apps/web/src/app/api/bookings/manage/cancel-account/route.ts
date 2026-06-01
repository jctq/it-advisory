import { NextResponse } from 'next/server';
import { accountBookingCancellationSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { requestAccountBookingCancellation } from '@/lib/booking/request-booking-cancellation';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

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
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = accountBookingCancellationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const result = await requestAccountBookingCancellation({
    bookingId: parsed.data.bookingId,
    bookingReference: parsed.data.bookingReference,
    visitorId,
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
