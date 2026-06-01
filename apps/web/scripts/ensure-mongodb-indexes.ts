/**
 * Creates indexes that speed up account diagnostics and payment reconciliation.
 * Run: `pnpm --filter web db:ensure-indexes`
 */
import { MongoClient } from 'mongodb';
import { COLLECTIONS } from '@teqmd/domain/collections';
import { loadLocalEnvIfNeeded } from './load-local-env';

async function ensureIndexes(): Promise<void> {
  loadLocalEnvIfNeeded();
  const uri = process.env.MONGODB_URI?.trim() ?? '';
  if (uri.length === 0) {
    throw new Error(
      'MONGODB_URI is not set. Add it to Railway variables, or to apps/web/.env.local for local runs.',
    );
  }
  const dbName = process.env.MONGODB_DB_NAME ?? 'teqmd';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await db.collection(COLLECTIONS.diagnosticSessions).createIndexes([
    { key: { visitorId: 1, updatedAt: -1 }, name: 'diagnostic_sessions_visitor_updated' },
  ]);
  await db.collection(COLLECTIONS.bookings).createIndexes([
    { key: { diagnosticSessionId: 1, createdAt: 1 }, name: 'bookings_diagnostic_session_created' },
  ]);
  await db.collection(COLLECTIONS.bookingRefunds).createIndexes([
    { key: { status: 1, requestedAt: -1 }, name: 'booking_refunds_status_requested' },
    { key: { bookingId: 1 }, name: 'booking_refunds_booking' },
  ]);
  await db.collection(COLLECTIONS.paymentTransactions).createIndexes([
    { key: { visitorId: 1, status: 1, updatedAt: -1 }, name: 'payments_visitor_status_updated' },
    { key: { diagnosticSessionIdHex: 1, createdAt: -1 }, name: 'payments_diagnostic_session_created' },
  ]);
  await client.close();
  console.log('MongoDB indexes ensured.');
}

void ensureIndexes().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
