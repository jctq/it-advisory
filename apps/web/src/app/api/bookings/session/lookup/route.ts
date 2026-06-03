import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { findGuestBookingManageView } from '@/lib/data/booking-guest-manage';
import { guestBookingManageCredentialsSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

/**
 * Guest session-room lookup — same credential check as manage booking, without the manage-booking feature gate.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'guest_booking_lookup');
  if (rateLimited !== null) {
    return rateLimited;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = guestBookingManageCredentialsSchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const view = await findGuestBookingManageView(parsed.data);
  if (view === null) {
    return NextResponse.json(
      {
        error: 'We could not find a booking matching those details. Check your reference, email, and phone.',
        code: 'booking_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, booking: view });
}
