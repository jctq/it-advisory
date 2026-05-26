import {
  findPaymentTransactionById,
  listPaidUnfulfilledPaymentTransactionsForVisitor,
  listReconcilablePaymentTransactionsForVisitor,
  type PaymentTransactionRow,
} from '@/lib/data/payment-transactions';
import { ensurePaidTransactionFulfilled } from '@/lib/payments/payment-completion';
import { reconcilePaymentTransactionIfPending } from '@/lib/payments/payment-reconciliation';

export type ReconcileVisitorPaymentsResult = {
  readonly reconciledCount: number;
  readonly fulfilledCount: number;
};

function countPaymentChanges(before: PaymentTransactionRow, after: PaymentTransactionRow): boolean {
  return before.status !== after.status || before.bookingId !== after.bookingId;
}

/**
 * Pulls provider status for open checkouts and fulfills paid transactions for a visitor.
 * Used when the customer never returns from the PSP redirect (e.g. closed PayMongo tab).
 */
export async function reconcileVisitorPaymentTransactions(
  visitorId: string,
): Promise<ReconcileVisitorPaymentsResult> {
  const transactions = await listReconcilablePaymentTransactionsForVisitor(visitorId);
  let reconciledCount = 0;
  let fulfilledCount = 0;
  for (const transaction of transactions) {
    const refreshed = await reconcilePaymentTransactionIfPending(transaction);
    if (countPaymentChanges(transaction, refreshed)) {
      reconciledCount += 1;
    }
  }
  const paidUnfulfilled = await listPaidUnfulfilledPaymentTransactionsForVisitor(visitorId);
  for (const transaction of paidUnfulfilled) {
    const beforeBookingId = transaction.bookingId;
    const refreshed = await ensurePaidTransactionFulfilled(transaction);
    if (beforeBookingId === null && refreshed.bookingId !== null) {
      fulfilledCount += 1;
    }
  }
  return { reconciledCount, fulfilledCount };
}

export async function reconcilePaymentTransactionById(transactionId: string): Promise<PaymentTransactionRow | null> {
  const transaction = await findPaymentTransactionById(transactionId);
  if (transaction === null) {
    return null;
  }
  let refreshed = await reconcilePaymentTransactionIfPending(transaction);
  refreshed = await ensurePaidTransactionFulfilled(refreshed);
  return findPaymentTransactionById(transactionId) ?? refreshed;
}
