import { listExpiredHoldTransactions } from '@/lib/data/payment-transactions';
import { applyPaymentStatusToBooking } from '@/lib/payments/payment-completion';

export async function expireStalePaymentHolds(): Promise<number> {
  const expired = await listExpiredHoldTransactions(new Date());
  let count = 0;
  for (const transaction of expired) {
    const result = await applyPaymentStatusToBooking({
      transaction,
      nextStatus: 'expired',
      expiredBookingDisposition: 'retain_pending',
    });
    if (result !== null) {
      count += 1;
    }
  }
  return count;
}
