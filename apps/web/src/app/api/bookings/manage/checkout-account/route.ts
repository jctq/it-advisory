import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { createPaymentCheckoutForAccountBooking } from '@/lib/payments/payment-checkout-resume';
import { accountBookingManageCheckoutSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { resolveCheckoutAppBaseUrl } from '@/lib/server/resolve-checkout-app-base-url';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';
import { createCheckoutTiming } from '@/lib/payments/checkout-timing';

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'payment_checkout_session');
  if (rateLimited !== null) {
    return rateLimited;
  }
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
  const parsed = accountBookingManageCheckoutSchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const visitorId = buildAccountVisitorId(user.id);
  const timing = createCheckoutTiming('account_manage_checkout');
  const result = await createPaymentCheckoutForAccountBooking({
    bookingId: parsed.data.bookingId,
    visitorId,
    gatewayId: parsed.data.gatewayId,
    paymentMethodId: parsed.data.paymentMethodId,
    paymentMethodLabel: parsed.data.paymentMethodLabel,
    appBaseUrl: resolveCheckoutAppBaseUrl(request, parsed.data.appBaseUrl),
    nativeInAppPaymentReturn: parsed.data.nativeInAppPaymentReturn === true,
    promoCode: parsed.data.promoCode,
    timing,
    sendPaymentReminderEmail: true,
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
        ...(result.debug !== undefined ? { debug: result.debug } : {}),
      },
      { status },
    );
  }
  return NextResponse.json(result);
}
