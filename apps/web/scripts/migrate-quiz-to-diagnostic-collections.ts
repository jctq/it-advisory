/**
 * One-time migration: legacy `quiz_*` collections and `quizSession*` fields → `diagnostic_*` naming.
 * Run after deploying code that reads the new names:
 *   pnpm --filter web db:migrate-quiz-to-diagnostic
 */
import { MongoClient } from 'mongodb';
import { COLLECTIONS } from '@teqmd/domain/collections';
import { loadLocalEnvIfNeeded } from './load-local-env';

const LEGACY_COLLECTIONS = {
  quizSessions: 'quiz_sessions',
  quizAudit: 'quiz_audit',
} as const;

const LEGACY_INDEX_NAMES = {
  quizSessionsVisitorUpdated: 'quiz_sessions_visitor_updated',
  bookingsQuizSessionCreated: 'bookings_quiz_session_created',
  paymentsQuizSessionCreated: 'payments_quiz_session_created',
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

async function dropIndexIfExists(
  collection: ReturnType<ReturnType<MongoClient['db']>['collection']>,
  indexName: string,
): Promise<void> {
  try {
    await collection.dropIndex(indexName);
    console.log(`Dropped index ${indexName}`);
  } catch {
    /* index may not exist */
  }
}

async function migrate(): Promise<void> {
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
  await renameCollectionIfNeeded(db, LEGACY_COLLECTIONS.quizSessions, COLLECTIONS.diagnosticSessions);
  await renameCollectionIfNeeded(db, LEGACY_COLLECTIONS.quizAudit, COLLECTIONS.diagnosticAudit);
  const bookings = db.collection(COLLECTIONS.bookings);
  const bookingRename = await bookings.updateMany(
    { quizSessionId: { $exists: true } },
    { $rename: { quizSessionId: 'diagnosticSessionId' } },
  );
  console.log(`Bookings: renamed quizSessionId → diagnosticSessionId on ${bookingRename.modifiedCount} document(s)`);
  const payments = db.collection(COLLECTIONS.paymentTransactions);
  const paymentRename = await payments.updateMany(
    { quizSessionIdHex: { $exists: true } },
    { $rename: { quizSessionIdHex: 'diagnosticSessionIdHex' } },
  );
  console.log(
    `Payment transactions: renamed quizSessionIdHex → diagnosticSessionIdHex on ${paymentRename.modifiedCount} document(s)`,
  );
  await dropIndexIfExists(bookings, LEGACY_INDEX_NAMES.bookingsQuizSessionCreated);
  await dropIndexIfExists(payments, LEGACY_INDEX_NAMES.paymentsQuizSessionCreated);
  await dropIndexIfExists(
    db.collection(COLLECTIONS.diagnosticSessions),
    LEGACY_INDEX_NAMES.quizSessionsVisitorUpdated,
  );
  await client.close();
  console.log('Migration complete. Run: pnpm --filter web db:ensure-indexes');
}

void migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
