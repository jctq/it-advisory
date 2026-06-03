import { NextResponse } from 'next/server';
import { findLatestPaymentTransactionByDiagnosticSessionIdHex } from '@/lib/data/payment-transactions';
import { reconcilePaymentTransactionById } from '@/lib/payments/reconcile-visitor-payments';
import { rejectUnlessAdminSession } from '@/lib/server/require-admin-session';

type RouteContext = {
  readonly params: Promise<{ readonly sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const adminDenied = await rejectUnlessAdminSession(_request);
  if (adminDenied !== null) {
    return adminDenied;
  }
  const { sessionId } = await context.params;
  const transaction = await findLatestPaymentTransactionByDiagnosticSessionIdHex(sessionId);
  if (transaction === null) {
    return NextResponse.json({ error: 'No checkout found for this diagnostic session.' }, { status: 404 });
  }
  const refreshed = await reconcilePaymentTransactionById(transaction.id);
  if (refreshed === null) {
    return NextResponse.json({ error: 'Payment transaction not found.' }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    transactionId: refreshed.id,
    status: refreshed.status,
    bookingId: refreshed.bookingId,
  });
}
