import { listExpiredHoldTransactions, updatePaymentTransactionStatus } from '@/lib/data/payment-transactions';
import { applyPaymentStatusToBooking } from '@/lib/payments/payment-completion';

export async function expireStalePaymentHolds(): Promise<number> {
  const expired = await listExpiredHoldTransactions(new Date());
  let count = 0;
  for (const transaction of expired) {
    const result = await applyPaymentStatusToBooking({ transaction, nextStatus: 'expired' });
    if (result !== null) {
      await updatePaymentTransactionStatus({
        transactionId: transaction.id,
        status: 'expired',
      });
      count += 1;
    }
  }
  return count;
}
