import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { UserAccountDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import { hashPasswordPlain } from '@/lib/server/password-credentials';

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export function normalizeAccountEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function findUserByEmailNormalized(emailNormalized: string): Promise<(UserAccountDocument & { _id: ObjectId }) | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<UserAccountDocument>(COLLECTIONS.users).findOne({ emailNormalized });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return doc as UserAccountDocument & { _id: ObjectId };
}

export async function findUserById(userId: ObjectId): Promise<(UserAccountDocument & { _id: ObjectId }) | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<UserAccountDocument>(COLLECTIONS.users).findOne({ _id: userId });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return doc as UserAccountDocument & { _id: ObjectId };
}

export type InsertUserAccountInput = {
  readonly emailNormalized: string;
  readonly plainPassword: string;
};

/**
 * Registers a new account. Returns null when MongoDB is unavailable or the email is taken.
 */
export async function insertUserAccount(input: InsertUserAccountInput): Promise<ObjectId | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const doc: Omit<UserAccountDocument, '_id'> = {
    emailNormalized: input.emailNormalized,
    passwordHash: hashPasswordPlain(input.plainPassword),
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await db.collection<UserAccountDocument>(COLLECTIONS.users).insertOne(doc);
    return result.insertedId;
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: number }).code : undefined;
    if (code === 11000) {
      return null;
    }
    throw err;
  }
}
