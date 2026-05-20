import { NextResponse } from 'next/server';
import { findGuestBookingManageView } from '@/lib/data/booking-guest-manage';
import { guestBookingManageCredentialsSchema } from '@/lib/marketing/guest-booking-manage-schema';
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
  const parsed = guestBookingManageCredentialsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
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
