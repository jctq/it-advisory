import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import { dispatchPaymentReminderForVisitor } from '@/lib/payments/dispatch-payment-reminder-for-visitor';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

const postBodySchema = z.object({
  transactionId: z.string().regex(/^[a-f\d]{24}$/i),
});

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'payment_checkout_session');
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
  const visitorId = await resolveMarketingVisitorId(request);
  const result = await dispatchPaymentReminderForVisitor({
    transactionId: parsed.data.transactionId,
    visitorId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: 'Payment session not found.', code: result.code }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
