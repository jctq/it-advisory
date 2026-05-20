import { NextResponse } from 'next/server';
import { findGuestBookingManageViewForAccountVisitor } from '@/lib/data/booking-guest-manage';
import { accountBookingManageLookupSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Loads manage view for a booking that belongs to the signed-in marketing account (no email/phone lookup).
 */
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
  const parsed = accountBookingManageLookupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const view = await findGuestBookingManageViewForAccountVisitor(parsed.data.bookingId, visitorId);
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
