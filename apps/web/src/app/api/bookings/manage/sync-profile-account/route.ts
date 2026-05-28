import { NextResponse } from 'next/server';
import { syncAccountProfileForManagedBooking } from '@/lib/data/booking-guest-manage';
import { accountBookingManageLookupSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Copies the signed-in account profile onto the booking’s lead row, then returns an updated manage view.
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
  const result = await syncAccountProfileForManagedBooking(parsed.data.bookingId, visitorId);
  if (!result.ok) {
    const status = result.code === 'booking_not_found' ? 404 : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}
