/**
 * One-shot payment-hold maintenance job for Railway Cron (or manual runs).
 * Invokes the same logic as POST /api/cron/payment-holds without an HTTP round-trip.
 */
import { cancelExpiredPaymentWindowBookings } from '../src/lib/payments/cancel-expired-payment-window-bookings';
import { expireStalePaymentHolds } from '../src/lib/payments/hold-expiry';
import { reconcileStalePaymentTransactions } from '../src/lib/payments/reconcile-stale-payments';

async function runPaymentHoldsCron(): Promise<void> {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error('[cron:payment-holds] MONGODB_URI is not set');
    process.exit(1);
  }
  const [expiredCount, reconciledCount, cancelledHoldCount] = await Promise.all([
    expireStalePaymentHolds(),
    reconcileStalePaymentTransactions(),
    cancelExpiredPaymentWindowBookings(),
  ]);
  console.log(
    JSON.stringify({
      ok: true,
      expiredCount,
      reconciledCount,
      cancelledHoldCount,
    }),
  );
}

runPaymentHoldsCron().catch((error: unknown) => {
  console.error('[cron:payment-holds]', error);
  process.exit(1);
});
