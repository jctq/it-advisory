import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { UserAuthSessionDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

const SESSION_TOKEN_BYTE_LENGTH = 32;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function hashSessionToken(rawToken: Buffer): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export type CreatedUserAuthSession = {
  readonly cookieValue: string;
  readonly expiresAt: Date;
};

/**
 * Persists a new auth session and returns the opaque cookie payload (`sessionId.tokenBase64url`).
 */
export async function createUserAuthSession(userId: ObjectId): Promise<CreatedUserAuthSession | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const rawToken = randomBytes(SESSION_TOKEN_BYTE_LENGTH);
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const doc: Omit<UserAuthSessionDocument, '_id'> = {
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
  };
  const result = await db.collection<UserAuthSessionDocument>(COLLECTIONS.userAuthSessions).insertOne(doc);
  const cookieValue = `${result.insertedId.toHexString()}.${rawToken.toString('base64url')}`;
  return { cookieValue, expiresAt };
}

export type ResolvedAuthSessionUser = {
  readonly userId: ObjectId;
};

/**
 * Validates a cookie value and returns the linked user id when the session is active.
 */
export async function resolveUserAuthSession(cookieValue: string | undefined): Promise<ResolvedAuthSessionUser | null> {
  if (!hasMongoUri() || cookieValue === undefined || cookieValue.length === 0) {
    return null;
  }
  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex <= 0 || dotIndex >= cookieValue.length - 1) {
    return null;
  }
  const sessionIdHex = cookieValue.slice(0, dotIndex);
  const tokenPart = cookieValue.slice(dotIndex + 1);
  let sessionId: ObjectId;
  try {
    sessionId = new ObjectId(sessionIdHex);
  } catch {
    return null;
  }
  let rawToken: Buffer;
  try {
    rawToken = Buffer.from(tokenPart, 'base64url');
  } catch {
    return null;
  }
  if (rawToken.length !== SESSION_TOKEN_BYTE_LENGTH) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<UserAuthSessionDocument>(COLLECTIONS.userAuthSessions).findOne({ _id: sessionId });
  if (doc === null || doc.userId === undefined) {
    return null;
  }
  if (doc.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const expectedHash = createHash('sha256').update(rawToken).digest();
  const actualHash = Buffer.from(doc.tokenHash, 'hex');
  if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
    return null;
  }
  return { userId: doc.userId };
}

export async function deleteUserAuthSessionByCookieValue(cookieValue: string | undefined): Promise<void> {
  if (!hasMongoUri() || cookieValue === undefined || cookieValue.length === 0) {
    return;
  }
  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex <= 0) {
    return;
  }
  const sessionIdHex = cookieValue.slice(0, dotIndex);
  let sessionId: ObjectId;
  try {
    sessionId = new ObjectId(sessionIdHex);
  } catch {
    return;
  }
  const db = await getDb();
  await db.collection<UserAuthSessionDocument>(COLLECTIONS.userAuthSessions).deleteOne({ _id: sessionId });
}
