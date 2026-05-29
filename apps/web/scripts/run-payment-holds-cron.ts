/**
 * One-shot payment-hold maintenance job for Railway Cron (or manual runs).
 * Invokes the same logic as POST /api/cron/payment-holds without an HTTP round-trip.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeMongoConnection } from '../src/lib/mongodb';
import { cancelExpiredPaymentWindowBookings } from '../src/lib/payments/cancel-expired-payment-window-bookings';
import { expireStalePaymentHolds } from '../src/lib/payments/hold-expiry';
import { reconcileStalePaymentTransactions } from '../src/lib/payments/reconcile-stale-payments';

function loadLocalEnvIfNeeded(): void {
  if (process.env.MONGODB_URI?.trim()) {
    return;
  }
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const envLocalPath = resolve(appRoot, '.env.local');
  if (!existsSync(envLocalPath) || typeof process.loadEnvFile !== 'function') {
    return;
  }
  process.loadEnvFile(envLocalPath);
}

async function runPaymentHoldsCron(): Promise<void> {
  loadLocalEnvIfNeeded();
  if (!process.env.MONGODB_URI?.trim()) {
    console.error('[cron:payment-holds] MONGODB_URI is not set');
    process.exit(1);
  }
  try {
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
  } finally {
    await closeMongoConnection();
  }
}

runPaymentHoldsCron().catch((error: unknown) => {
  console.error('[cron:payment-holds]', error);
  process.exit(1);
});
