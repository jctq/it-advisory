import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI ?? '';

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(uri, {
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
  if (!uri) {
    throw new Error('Missing MONGODB_URI');
  }
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = createClientPromise();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  const dbName = process.env.MONGODB_DB_NAME ?? 'it_advisory';
  return client.db(dbName);
}
