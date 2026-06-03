import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { guestBookingManageCredentialsSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { resolveGuestBookingByCredentials, isGuestBookingNotFound } from '@/lib/data/booking-guest-manage';
import { abandonOverduePendingBooking } from '@/lib/data/manage-booking-overdue-actions';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

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
  const parsed = guestBookingManageCredentialsSchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const resolved = await resolveGuestBookingByCredentials(parsed.data);
  if (isGuestBookingNotFound(resolved)) {
    return NextResponse.json({ error: 'Booking lookup failed.', code: 'credentials_mismatch' }, { status: 404 });
  }
  const result = await abandonOverduePendingBooking(resolved, { manageKind: 'guest' });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}
