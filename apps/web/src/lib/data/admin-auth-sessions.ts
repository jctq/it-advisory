/**
 * @deprecated Legacy opaque admin sessions — superseded by NextAuth JWT. Collection TTL expires old rows.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { AdminAuthSessionDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

const SESSION_TOKEN_BYTE_LENGTH = 32;
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function hashSessionToken(rawToken: Buffer): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export type CreatedAdminAuthSession = {
  readonly cookieValue: string;
  readonly expiresAt: Date;
};

/**
 * Persists a new admin session and returns the opaque cookie payload (`sessionId.tokenBase64url`).
 */
export async function createAdminAuthSession(): Promise<CreatedAdminAuthSession | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const rawToken = randomBytes(SESSION_TOKEN_BYTE_LENGTH);
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const doc: Omit<AdminAuthSessionDocument, '_id'> = {
    tokenHash,
    createdAt: now,
    expiresAt,
  };
  const result = await db.collection<AdminAuthSessionDocument>(COLLECTIONS.adminAuthSessions).insertOne(doc);
  const cookieValue = `${result.insertedId.toHexString()}.${rawToken.toString('base64url')}`;
  return { cookieValue, expiresAt };
}

/**
 * Validates an `admin_session` cookie value when the session is active.
 */
export async function resolveAdminAuthSession(cookieValue: string | undefined): Promise<boolean> {
  if (!hasMongoUri() || cookieValue === undefined || cookieValue.length === 0) {
    return false;
  }
  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex <= 0 || dotIndex >= cookieValue.length - 1) {
    return false;
  }
  const sessionIdHex = cookieValue.slice(0, dotIndex);
  const tokenPart = cookieValue.slice(dotIndex + 1);
  let sessionId: ObjectId;
  try {
    sessionId = new ObjectId(sessionIdHex);
  } catch {
    return false;
  }
  let rawToken: Buffer;
  try {
    rawToken = Buffer.from(tokenPart, 'base64url');
  } catch {
    return false;
  }
  if (rawToken.length !== SESSION_TOKEN_BYTE_LENGTH) {
    return false;
  }
  const db = await getDb();
  const doc = await db.collection<AdminAuthSessionDocument>(COLLECTIONS.adminAuthSessions).findOne({ _id: sessionId });
  if (doc === null) {
    return false;
  }
  if (doc.expiresAt.getTime() <= Date.now()) {
    return false;
  }
  const expectedHash = createHash('sha256').update(rawToken).digest();
  const actualHash = Buffer.from(doc.tokenHash, 'hex');
  if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
    return false;
  }
  return true;
}

export async function deleteAdminAuthSessionByCookieValue(cookieValue: string | undefined): Promise<void> {
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
  await db.collection<AdminAuthSessionDocument>(COLLECTIONS.adminAuthSessions).deleteOne({ _id: sessionId });
}
