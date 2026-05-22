import { NextResponse } from 'next/server';
import { createPaymentCheckoutForExistingBooking } from '@/lib/payments/payment-checkout-resume';
import { guestBookingManageCheckoutSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { resolveCheckoutAppBaseUrl } from '@/lib/server/resolve-checkout-app-base-url';

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
  const parsed = guestBookingManageCheckoutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await createPaymentCheckoutForExistingBooking({
    credentials: {
      bookingReference: parsed.data.bookingReference,
      email: parsed.data.email,
      phoneLastFour: parsed.data.phoneLastFour,
    },
    gatewayId: parsed.data.gatewayId,
    paymentMethodId: parsed.data.paymentMethodId,
    paymentMethodLabel: parsed.data.paymentMethodLabel,
    appBaseUrl: resolveCheckoutAppBaseUrl(request, parsed.data.appBaseUrl),
    nativeInAppPaymentReturn: parsed.data.nativeInAppPaymentReturn === true,
    promoCode: parsed.data.promoCode,
  });
  if (!result.ok) {
    const status =
      result.code === 'booking_not_payable'
        ? 409
        : result.code === 'database_unavailable'
          ? 503
          : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(result);
}
