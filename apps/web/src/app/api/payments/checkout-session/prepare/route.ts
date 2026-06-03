import { NextResponse } from 'next/server';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { z } from 'zod';
import { PAYMENT_GATEWAY_IDS } from '@/domain/payment-types';
import { createPaymentCheckoutSession } from '@/lib/payments/payment-checkout';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { findDiagnosticSessionForVisitor } from '@/lib/data/diagnostic-sessions';
import { resolveDiagnosticSessionObjectIdHexFromMarketingRef } from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import { resolveCheckoutAppBaseUrl } from '@/lib/server/resolve-checkout-app-base-url';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';
import { createCheckoutTiming } from '@/lib/payments/checkout-timing';

const postBodySchema = z.object({
  gatewayId: z.enum(PAYMENT_GATEWAY_IDS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(48),
  serviceKey: z.string().min(1).max(120).default('project-rescue'),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(320),
  customerCompany: z.string().max(200).optional(),
  customerPhone: z.string().min(1).max(50),
  diagnosticSessionId: z.string().min(1).max(512),
  paymentMethodId: z.string().min(1).max(64),
  paymentMethodLabel: z.string().min(1).max(120).optional(),
  appBaseUrl: z.string().max(240).optional(),
  nativeInAppPaymentReturn: z.boolean().optional(),
  promoCode: z.string().max(64).optional(),
  recordingOptIn: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'payment_checkout_prepare');
  if (rateLimited !== null) {
    return rateLimited;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  const resolvedDiagnosticSessionHex = resolveDiagnosticSessionObjectIdHexFromMarketingRef(parsed.data.diagnosticSessionId);
  if (resolvedDiagnosticSessionHex === null) {
    return NextResponse.json({ error: 'Invalid diagnostic session reference', code: 'diagnostic_session_invalid_id' }, { status: 400 });
  }
  const visitorId = await resolveMarketingVisitorId(request);
  const ownedDiagnosticSession = await findDiagnosticSessionForVisitor(visitorId, resolvedDiagnosticSessionHex);
  if (ownedDiagnosticSession === null) {
    return NextResponse.json(
      {
        error: 'This diagnostic was not found or you no longer have access to it.',
        code: 'diagnostic_session_not_found',
      },
      { status: 404 },
    );
  }
  const timing = createCheckoutTiming('marketing_checkout_prepare');
  const result = await createPaymentCheckoutSession({
    gatewayId: parsed.data.gatewayId,
    visitorId,
    date: parsed.data.date,
    time: parsed.data.time,
    serviceKey: parsed.data.serviceKey,
    customerName: parsed.data.customerName,
    customerEmail: parsed.data.customerEmail,
    customerCompany: parsed.data.customerCompany,
    customerPhone: parsed.data.customerPhone,
    diagnosticSessionId: parsed.data.diagnosticSessionId,
    paymentMethodId: parsed.data.paymentMethodId,
    paymentMethodLabel: parsed.data.paymentMethodLabel,
    appBaseUrl: resolveCheckoutAppBaseUrl(request, parsed.data.appBaseUrl),
    nativeInAppPaymentReturn: parsed.data.nativeInAppPaymentReturn === true,
    promoCode: parsed.data.promoCode,
    recordingOptIn: parsed.data.recordingOptIn === true,
    diagnosticSessionObjectIdHex: resolvedDiagnosticSessionHex,
    timing,
    sendPaymentReminderEmail: false,
  });
  timing.logAndFinish();
  if (!result.ok) {
    const status =
      result.code === 'booking_slot_unavailable' || result.code === 'diagnostic_session_already_booked'
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
