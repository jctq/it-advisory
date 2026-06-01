/**
 * One-time migration: legacy `quiz_*` collections and `quizSession*` fields → `diagnostic_*` naming.
 * Run after deploying code that reads the new names:
 *   pnpm --filter web exec tsx scripts/migrate-quiz-to-diagnostic-collections.ts
 */
import { MongoClient } from 'mongodb';
import { COLLECTIONS } from '@techmd/domain/collections';

const LEGACY_COLLECTIONS = {
  diagnosticSessions: 'diagnostic_sessions',
  diagnosticAudit: 'diagnostic_audit',
} as const;

async function renameCollectionIfNeeded(
  db: ReturnType<MongoClient['db']>,
  from: string,
  to: string,
): Promise<void> {
  const collections = await db.listCollections({ name: from }).toArray();
  if (collections.length === 0) {
    console.log(`Skip collection rename ${from} → ${to} (source missing)`);
    return;
  }
  const targetExists = (await db.listCollections({ name: to }).toArray()).length > 0;
  if (targetExists) {
    console.log(`Skip collection rename ${from} → ${to} (target already exists)`);
    return;
  }
  await db.collection(from).rename(to);
  console.log(`Renamed collection ${from} → ${to}`);
}

async function migrate(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim() ?? '';
  if (uri.length === 0) {
    throw new Error('Set MONGODB_URI before running this script.');
  }
  const dbName = process.env.MONGODB_DB_NAME ?? 'techmd';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await renameCollectionIfNeeded(db, LEGACY_COLLECTIONS.diagnosticSessions, COLLECTIONS.diagnosticSessions);
  await renameCollectionIfNeeded(db, LEGACY_COLLECTIONS.diagnosticAudit, COLLECTIONS.diagnosticAudit);
  const bookings = db.collection(COLLECTIONS.bookings);
  const bookingRename = await bookings.updateMany(
    { diagnosticSessionId: { $exists: true } },
    { $rename: { diagnosticSessionId: 'diagnosticSessionId' } },
  );
  console.log(`Bookings: renamed diagnosticSessionId on ${bookingRename.modifiedCount} document(s)`);
  const payments = db.collection(COLLECTIONS.paymentTransactions);
  const paymentRename = await payments.updateMany(
    { diagnosticSessionIdHex: { $exists: true } },
    { $rename: { diagnosticSessionIdHex: 'diagnosticSessionIdHex' } },
  );
  console.log(`Payment transactions: renamed diagnosticSessionIdHex on ${paymentRename.modifiedCount} document(s)`);
  try {
    await bookings.dropIndex('bookings_diagnostic_session_created');
  } catch {
    /* index may not exist */
  }
  try {
    await payments.dropIndex('payments_diagnostic_session_created');
  } catch {
    /* index may not exist */
  }
  try {
    await db.collection(COLLECTIONS.diagnosticSessions).dropIndex('diagnostic_sessions_visitor_updated');
  } catch {
    /* index may not exist */
  }
  await client.close();
  console.log('Migration complete. Run ensure-mongodb-indexes.ts to create new indexes.');
}

void migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
