import { MongoClient, type Db } from 'mongodb';

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getMongoUri(): string {
  return process.env.MONGODB_URI?.trim() ?? '';
}

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(getMongoUri(), {
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 50),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE ?? 5),
    maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_TIME_MS ?? 60_000),
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10_000),
  });
  return client.connect();
}

/**
 * Reuses one MongoClient per server process (Railway Node). Caches on globalThis in dev for HMR.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  if (getMongoUri().length === 0) {
    throw new Error('Missing MONGODB_URI');
  }
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = createClientPromise();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  const dbName = process.env.MONGODB_DB_NAME ?? 'techmd';
  return client.db(dbName);
}

/** Closes the shared client so one-shot scripts (cron, CLI) can exit cleanly. */
export async function closeMongoConnection(): Promise<void> {
  const clientPromise = globalForMongo._mongoClientPromise;
  if (clientPromise === undefined) {
    return;
  }
  globalForMongo._mongoClientPromise = undefined;
  try {
    const client = await clientPromise;
    await client.close();
  } catch {
    // Ignore close errors when connect never completed.
  }
}
