import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PAYMENT_GATEWAY_IDS } from '@/domain/payment-types';
import { createPaymentCheckoutSession } from '@/lib/payments/payment-checkout';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';
import { resolveQuizSessionObjectIdHexFromMarketingRef } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { resolveCheckoutAppBaseUrl } from '@/lib/server/resolve-checkout-app-base-url';

const postBodySchema = z.object({
  gatewayId: z.enum(PAYMENT_GATEWAY_IDS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(48),
  serviceKey: z.string().min(1).max(120).default('project-rescue'),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(320),
  customerCompany: z.string().max(200).optional(),
  customerPhone: z.string().min(1).max(50),
  quizSessionId: z.string().min(1).max(512),
  paymentMethodId: z.string().min(1).max(64),
  paymentMethodLabel: z.string().min(1).max(120).optional(),
  /** When set (e.g. native), must match request origin, NEXT_PUBLIC_APP_URL, or CHECKOUT_ALLOWED_APP_BASE_URLS. */
  appBaseUrl: z.string().max(240).optional(),
  /** Use minimal HTML return URL so in-app payment browsers can close the auth session. */
  nativeInAppPaymentReturn: z.boolean().optional(),
  promoCode: z.string().max(64).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const resolvedQuizSessionHex = resolveQuizSessionObjectIdHexFromMarketingRef(parsed.data.quizSessionId);
  if (resolvedQuizSessionHex === null) {
    return NextResponse.json({ error: 'Invalid quiz session reference', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  const visitorId = await resolveMarketingVisitorId(request);
  const ownedQuizSession = await findQuizSessionForVisitor(visitorId, resolvedQuizSessionHex);
  if (ownedQuizSession === null) {
    return NextResponse.json(
      {
        error: 'This diagnostic was not found or you no longer have access to it.',
        code: 'quiz_session_not_found',
      },
      { status: 404 },
    );
  }
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
    quizSessionId: parsed.data.quizSessionId,
    paymentMethodId: parsed.data.paymentMethodId,
    paymentMethodLabel: parsed.data.paymentMethodLabel,
    appBaseUrl: resolveCheckoutAppBaseUrl(request, parsed.data.appBaseUrl),
    nativeInAppPaymentReturn: parsed.data.nativeInAppPaymentReturn === true,
    promoCode: parsed.data.promoCode,
  });
  if (!result.ok) {
    const status =
      result.code === 'booking_slot_unavailable' || result.code === 'quiz_session_already_booked'
        ? 409
        : result.code === 'quiz_session_not_found'
          ? 404
          : result.code === 'database_unavailable'
            ? 503
            : result.code === 'promo_invalid'
              ? 400
              : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(result);
}
