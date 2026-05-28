import { executeCronRoute } from '@/lib/cron/execute-cron-route';
import { cancelExpiredPaymentWindowBookings } from '@/lib/payments/cancel-expired-payment-window-bookings';
import { expireStalePaymentHolds } from '@/lib/payments/hold-expiry';
import { reconcileStalePaymentTransactions } from '@/lib/payments/reconcile-stale-payments';

export async function POST(request: Request): Promise<Response> {
  return executeCronRoute({
    request,
    jobId: 'payment-holds',
    handler: async () => {
      const [expiredCount, reconciledCount, cancelledHoldCount] = await Promise.all([
        expireStalePaymentHolds(),
        reconcileStalePaymentTransactions(),
        cancelExpiredPaymentWindowBookings(),
      ]);
      return { expiredCount, reconciledCount, cancelledHoldCount };
    },
  });
}
