import 'server-only';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { COLLECTIONS } from '@/domain/collections';
import type { AdminOtpChallengeDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

const OTP_LENGTH = 6 as const;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5 as const;

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');
}

export type IssueAdminOtpChallengeResult =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly reason: 'cooldown'; readonly retryAfterSeconds: number };

/**
 * Creates or replaces the active OTP challenge for an allowlisted admin email.
 */
export async function issueAdminOtpChallenge(email: string): Promise<IssueAdminOtpChallengeResult> {
  if (!hasMongoUri()) {
    return { ok: true, code: generateOtpCode() };
  }
  const normalizedEmail = normalizeEmail(email);
  const db = await getDb();
  const collection = db.collection<AdminOtpChallengeDocument>(COLLECTIONS.adminOtpChallenges);
  const existing = await collection.findOne({ email: normalizedEmail });
  const nowMs = Date.now();
  if (existing !== null && nowMs - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((RESEND_COOLDOWN_MS - (nowMs - existing.lastSentAt.getTime())) / 1000),
    );
    return { ok: false, reason: 'cooldown', retryAfterSeconds };
  }
  const code = generateOtpCode();
  const now = new Date(nowMs);
  await collection.updateOne(
    { email: normalizedEmail },
    {
      $set: {
        email: normalizedEmail,
        codeHash: hashOtpCode(code),
        attemptCount: 0,
        lastSentAt: now,
        updatedAt: now,
        expiresAt: new Date(nowMs + OTP_TTL_MS),
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return { ok: true, code };
}

export type VerifyAdminOtpCodeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'invalid' | 'expired' | 'too_many_attempts' | 'not_found';
    };

/**
 * Validates a submitted OTP against the active challenge for the email.
 */
export async function verifyAdminOtpCode(email: string, code: string): Promise<VerifyAdminOtpCodeResult> {
  if (!hasMongoUri()) {
    return code.length === OTP_LENGTH && /^\d+$/.test(code) ? { ok: true } : { ok: false, reason: 'invalid' };
  }
  const normalizedEmail = normalizeEmail(email);
  const db = await getDb();
  const collection = db.collection<AdminOtpChallengeDocument>(COLLECTIONS.adminOtpChallenges);
  const challenge = await collection.findOne({ email: normalizedEmail });
  if (challenge === null) {
    return { ok: false, reason: 'not_found' };
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    await collection.deleteOne({ email: normalizedEmail });
    return { ok: false, reason: 'expired' };
  }
  if (challenge.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    await collection.deleteOne({ email: normalizedEmail });
    return { ok: false, reason: 'too_many_attempts' };
  }
  const submittedHash = createHash('sha256').update(code.trim()).digest();
  const expectedHash = Buffer.from(challenge.codeHash, 'hex');
  const isMatch =
    submittedHash.length === expectedHash.length && timingSafeEqual(submittedHash, expectedHash);
  if (!isMatch) {
    await collection.updateOne(
      { email: normalizedEmail },
      { $inc: { attemptCount: 1 }, $set: { updatedAt: new Date() } },
    );
    return { ok: false, reason: 'invalid' };
  }
  await collection.deleteOne({ email: normalizedEmail });
  return { ok: true };
}
