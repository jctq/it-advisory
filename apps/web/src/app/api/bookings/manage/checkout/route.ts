import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { createPaymentCheckoutForExistingBooking } from '@/lib/payments/payment-checkout-resume';
import { guestBookingManageCheckoutSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { resolveCheckoutAppBaseUrl } from '@/lib/server/resolve-checkout-app-base-url';
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
  const parsed = guestBookingManageCheckoutSchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
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
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        ...(result.payabilityCode !== undefined ? { payabilityCode: result.payabilityCode } : {}),
        ...(result.debug !== undefined ? { debug: result.debug } : {}),
      },
      { status },
    );
  }
  return NextResponse.json(result);
}
