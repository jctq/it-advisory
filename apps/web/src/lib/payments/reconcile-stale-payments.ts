import { listStaleReconcilablePaymentTransactions } from '@/lib/data/payment-transactions';
import { ensurePaidTransactionFulfilled } from '@/lib/payments/payment-completion';
import { reconcilePaymentTransactionIfPending } from '@/lib/payments/payment-reconciliation';

const STALE_PAYMENT_MINUTES = 2 as const;

export async function reconcileStalePaymentTransactions(): Promise<number> {
  const olderThan = new Date(Date.now() - STALE_PAYMENT_MINUTES * 60_000);
  const transactions = await listStaleReconcilablePaymentTransactions(olderThan);
  let updatedCount = 0;
  for (const transaction of transactions) {
    const beforeStatus = transaction.status;
    const beforeBookingId = transaction.bookingId;
    let refreshed = await reconcilePaymentTransactionIfPending(transaction);
    refreshed = await ensurePaidTransactionFulfilled(refreshed);
    if (refreshed.status !== beforeStatus || refreshed.bookingId !== beforeBookingId) {
      updatedCount += 1;
    }
  }
  return updatedCount;
}
