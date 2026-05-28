import { NextResponse } from 'next/server';
import { isGuestBookingNotFound, resolveGuestBookingByCredentials } from '@/lib/data/booking-guest-manage';
import { rescheduleOverduePendingBooking } from '@/lib/data/manage-booking-overdue-actions';
import { guestBookingManageRescheduleSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';

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
  const parsed = guestBookingManageRescheduleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const resolved = await resolveGuestBookingByCredentials({
    bookingReference: parsed.data.bookingReference,
    email: parsed.data.email,
    phoneLastFour: parsed.data.phoneLastFour,
  });
  if (isGuestBookingNotFound(resolved)) {
    return NextResponse.json({ error: 'Booking lookup failed.', code: 'credentials_mismatch' }, { status: 404 });
  }
  const result = await rescheduleOverduePendingBooking(
    resolved,
    { dateYmd: parsed.data.date, timeLabel: parsed.data.time },
    { manageKind: 'guest' },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}
