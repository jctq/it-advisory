import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { createPaymentCheckoutForExistingBooking } from '@/lib/payments/payment-checkout-resume';
import { guestBookingManageCheckoutSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { resolveCheckoutAppBaseUrl } from '@/lib/server/resolve-checkout-app-base-url';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';
import { createCheckoutTiming } from '@/lib/payments/checkout-timing';

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'payment_checkout_prepare');
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
  const parsed = guestBookingManageCheckoutSchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const timing = createCheckoutTiming('guest_manage_checkout_prepare');
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
    timing,
  });
  timing.logAndFinish();
  if (!result.ok) {
    const status =
      result.code === 'booking_not_payable'
        ? 409
        : result.code === 'database_unavailable'
          ? 503
          : 400;
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        ...(result.payabilityCode !== undefined ? { payabilityCode: result.payabilityCode } : {}),
      },
      { status },
    );
  }
  if (result.redirectUrl === null || result.redirectUrl.length === 0) {
    return NextResponse.json({ error: 'No redirect URL for this checkout.', code: 'no_redirect' }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    transactionId: result.transactionId,
    redirectUrl: result.redirectUrl,
    bookingId: result.bookingId,
    mock: result.mock,
  });
}
