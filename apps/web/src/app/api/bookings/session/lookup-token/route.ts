import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { findGuestBookingManageViewForSessionToken } from '@/lib/data/booking-guest-manage';
import { verifyBookingSessionAccessToken } from '@/lib/marketing/booking-session-access-token';
import { guestBookingSessionTokenLookupSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

/**
 * Loads session-room view from a signed email access token (no login or guest credentials).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'booking_token_lookup');
  if (rateLimited !== null) {
    return rateLimited;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = guestBookingSessionTokenLookupSchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const verified = verifyBookingSessionAccessToken(parsed.data.token);
  if (verified === null) {
    return NextResponse.json(
      {
        error: 'This session link is invalid or has expired. Enter your booking details below.',
        code: 'session_token_invalid',
      },
      { status: 401 },
    );
  }
  const view = await findGuestBookingManageViewForSessionToken(verified.bookingId);
  if (view === null) {
    return NextResponse.json(
      {
        error: 'We could not find an active session for this link.',
        code: 'booking_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, booking: view });
}
