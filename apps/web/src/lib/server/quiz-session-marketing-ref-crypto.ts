import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { MARKETING_QUIZ_SESSION_REF_PREFIX } from '@/lib/marketing/quiz-session-marketing-ref';

const AES_256_GCM = 'aes-256-gcm' as const;
const IV_LENGTH_BYTES = 12 as const;
const AUTH_TAG_LENGTH_BYTES = 16 as const;
const MIN_SECRET_LENGTH = 16 as const;

function resolveEncryptionKey(): Buffer | null {
  const raw = process.env.QUIZ_SESSION_URL_SECRET?.trim() ?? '';
  if (raw.length < MIN_SECRET_LENGTH) {
    return null;
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

/**
 * When {@link QUIZ_SESSION_URL_SECRET} is configured, returns an opaque URL-safe token for this quiz session row.
 * Otherwise returns the hex id unchanged (legacy / local dev).
 */
export function encodeQuizSessionRefForMarketingUrl(objectIdHex24: string): string {
  if (!/^[a-f\d]{24}$/i.test(objectIdHex24)) {
    throw new Error('Invalid quiz session object id');
  }
  const key = resolveEncryptionKey();
  if (key === null) {
    return objectIdHex24.toLowerCase();
  }
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_256_GCM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(objectIdHex24, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, ciphertext, tag]);
  return `${MARKETING_QUIZ_SESSION_REF_PREFIX}${combined.toString('base64url')}`;
}

/**
 * Resolves a marketing ref or raw ObjectId hex to a lowercase 24-char hex string. Returns null when invalid.
 */
export function resolveQuizSessionObjectIdHexFromMarketingRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (/^[a-f\d]{24}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (!trimmed.startsWith(MARKETING_QUIZ_SESSION_REF_PREFIX)) {
    return null;
  }
  const key = resolveEncryptionKey();
  if (key === null) {
    return null;
  }
  const encoded = trimmed.slice(MARKETING_QUIZ_SESSION_REF_PREFIX.length);
  let combined: Buffer;
  try {
    combined = Buffer.from(encoded, 'base64url');
  } catch {
    return null;
  }
  const minimumLength = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES + 1;
  if (combined.length < minimumLength) {
    return null;
  }
  const iv = combined.subarray(0, IV_LENGTH_BYTES);
  const tag = combined.subarray(combined.length - AUTH_TAG_LENGTH_BYTES);
  const ciphertext = combined.subarray(IV_LENGTH_BYTES, combined.length - AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv(AES_256_GCM, key, iv);
  decipher.setAuthTag(tag);
  try {
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    if (!/^[a-f\d]{24}$/i.test(plain)) {
      return null;
    }
    return plain.toLowerCase();
  } catch {
    return null;
  }
}
