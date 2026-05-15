import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { applyPaymentStatusToBooking, completeMockPayment } from '@/lib/payments/payment-completion';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';

const postBodySchema = z.object({
  transactionId: z.string().min(1).max(64),
  mock: z.boolean().optional(),
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
  const visitorId = await resolveMarketingVisitorId(request);
  if (parsed.data.mock === true && process.env.NODE_ENV === 'development') {
    const mockResult = await completeMockPayment(parsed.data.transactionId, visitorId);
    if (mockResult === null) {
      return NextResponse.json({ error: 'Payment session not found.' }, { status: 404 });
    }
    const transaction = await findPaymentTransactionById(parsed.data.transactionId, visitorId);
    return NextResponse.json({ ok: true, transaction });
  }
  const transaction = await findPaymentTransactionById(parsed.data.transactionId, visitorId);
  if (transaction === null) {
    return NextResponse.json({ error: 'Payment session not found.' }, { status: 404 });
  }
  if (transaction.status === 'paid') {
    return NextResponse.json({ ok: true, transaction });
  }
  return NextResponse.json({
    ok: false,
    transaction,
    message: 'Payment is still processing. Refresh in a moment.',
  });
}
