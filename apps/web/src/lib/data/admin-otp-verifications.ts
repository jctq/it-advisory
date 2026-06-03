import 'server-only';
import { COLLECTIONS } from '@/domain/collections';
import type { AdminOtpVerificationDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import { resolveAdminOtpVerificationTtlMs } from '@/lib/server/admin-email-otp-config';

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Marks an admin email as OTP-verified for the current session window.
 */
export async function grantAdminOtpVerification(email: string): Promise<void> {
  if (!hasMongoUri()) {
    return;
  }
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  const db = await getDb();
  await db.collection<AdminOtpVerificationDocument>(COLLECTIONS.adminOtpVerifications).updateOne(
    { email: normalizedEmail },
    {
      $set: {
        email: normalizedEmail,
        verifiedAt: now,
        expiresAt: new Date(now.getTime() + resolveAdminOtpVerificationTtlMs()),
      },
    },
    { upsert: true },
  );
}

/**
 * Returns whether the email has an active OTP verification grant.
 */
export async function hasActiveAdminOtpVerification(email: string): Promise<boolean> {
  if (!hasMongoUri()) {
    return false;
  }
  const normalizedEmail = normalizeEmail(email);
  const db = await getDb();
  const doc = await db.collection<AdminOtpVerificationDocument>(COLLECTIONS.adminOtpVerifications).findOne({
    email: normalizedEmail,
    expiresAt: { $gt: new Date() },
  });
  return doc !== null;
}

/**
 * Clears OTP verification when the admin signs out.
 */
export async function revokeAdminOtpVerification(email: string): Promise<void> {
  if (!hasMongoUri()) {
    return;
  }
  const normalizedEmail = normalizeEmail(email);
  const db = await getDb();
  await db.collection<AdminOtpVerificationDocument>(COLLECTIONS.adminOtpVerifications).deleteOne({
    email: normalizedEmail,
  });
}
