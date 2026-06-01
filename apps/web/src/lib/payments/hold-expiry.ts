import { getPaymentSettings } from '@/lib/data/payment-settings';
import { listExpiredHoldTransactions } from '@/lib/data/payment-transactions';
import { applyPaymentStatusToBooking } from '@/lib/payments/payment-completion';

export async function expireStalePaymentHolds(): Promise<number> {
  const now = new Date();
  const { holdExpiresMinutes } = await getPaymentSettings();
  const expired = await listExpiredHoldTransactions(now, holdExpiresMinutes);
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
