import { NextResponse } from 'next/server';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { completeMockPayment, ensurePaidTransactionFulfilled } from '@/lib/payments/payment-completion';
import { reconcilePaymentTransactionIfPending } from '@/lib/payments/payment-reconciliation';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';

type RouteContext = {
  readonly params: Promise<{ readonly transactionId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { transactionId } = await context.params;
  const visitorId = await resolveMarketingVisitorId(request);
  const url = new URL(request.url);
  const isMock = url.searchParams.get('mock') === '1';
  if (isMock && process.env.NODE_ENV === 'development') {
    await completeMockPayment(transactionId, visitorId);
  }
  let transaction = await findPaymentTransactionById(transactionId, visitorId);
  if (transaction === null) {
    return NextResponse.json({ error: 'Payment session not found.' }, { status: 404 });
  }
  transaction = await reconcilePaymentTransactionIfPending(transaction);
  transaction = await ensurePaidTransactionFulfilled(transaction);
  return NextResponse.json({
    transactionId: transaction.id,
    status: transaction.status,
    bookingId: transaction.bookingId,
    gatewayId: transaction.gatewayId,
    paymentMethodLabel: transaction.paymentMethodLabel,
    amountCentavos: transaction.amountCentavos,
    startsAtIso: transaction.startsAtIso,
    timezone: transaction.timezone,
    paidAtIso: transaction.paidAtIso,
    expiresAtIso: transaction.expiresAtIso,
  });
}
