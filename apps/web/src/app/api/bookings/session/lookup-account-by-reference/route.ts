import { NextResponse } from 'next/server';
import { findGuestBookingManageViewForAccountVisitorByReference } from '@/lib/data/booking-guest-manage';
import { accountBookingSessionReferenceLookupSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Loads session-room view for a signed-in account holder by booking reference suffix.
 */
export async function POST(request: Request): Promise<NextResponse> {
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
  const parsed = accountBookingSessionReferenceLookupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const view = await findGuestBookingManageViewForAccountVisitorByReference(
    parsed.data.bookingReference,
    visitorId,
  );
  if (view === null) {
    return NextResponse.json(
      {
        error: 'We could not find that booking for your account.',
        code: 'booking_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, booking: view });
}
