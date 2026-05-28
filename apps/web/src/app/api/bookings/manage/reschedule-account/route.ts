import { NextResponse } from 'next/server';
import { resolveBookingOwnedByVisitor, isGuestBookingNotFound } from '@/lib/data/booking-guest-manage';
import { rescheduleOverduePendingBooking } from '@/lib/data/manage-booking-overdue-actions';
import { accountBookingManageRescheduleSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

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
  const parsed = accountBookingManageRescheduleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const resolved = await resolveBookingOwnedByVisitor(parsed.data.bookingId, visitorId);
  if (isGuestBookingNotFound(resolved)) {
    return NextResponse.json(
      { error: 'We could not find that booking for your account.', code: 'booking_not_found' },
      { status: 404 },
    );
  }
  const result = await rescheduleOverduePendingBooking(
    resolved,
    { dateYmd: parsed.data.date, timeLabel: parsed.data.time },
    { expectedVisitorId: visitorId, manageKind: 'account' },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}
