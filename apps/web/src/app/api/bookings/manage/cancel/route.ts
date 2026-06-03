import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { guestBookingCancellationSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { requestGuestBookingCancellation } from '@/lib/booking/request-booking-cancellation';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

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
  const rateLimited = await executeRateLimitOrResponse(request, 'guest_booking_lookup');
  if (rateLimited !== null) {
    return rateLimited;
  }
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
    return jsonApiValidationError(parsed.error);
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
