import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { EncryptedCredentialBlob, PaymentGatewayCredentialsPlain } from '@/domain/payment-types';
import { decryptPaymentCredentials } from '@/lib/server/payment-credentials-crypto';

const AES_256_GCM = 'aes-256-gcm' as const;
const IV_LENGTH_BYTES = 12 as const;
const AUTH_TAG_LENGTH_BYTES = 16 as const;
const MIN_MASTER_KEY_LENGTH = 32 as const;

function resolveEmailMasterKey(): Buffer | null {
  const raw = process.env.EMAIL_CREDENTIALS_MASTER_KEY?.trim() ?? '';
  if (raw.length < MIN_MASTER_KEY_LENGTH) {
    return null;
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function canEncryptEmailCredentials(): boolean {
  return resolveEmailMasterKey() !== null;
}

function decryptWithKey(blob: EncryptedCredentialBlob, key: Buffer): PaymentGatewayCredentialsPlain {
  const iv = Buffer.from(blob.iv, 'base64url');
  const ciphertext = Buffer.from(blob.ciphertext, 'base64url');
  const tag = Buffer.from(blob.tag, 'base64url');
  if (tag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Invalid credential blob.');
  }
  const decipher = createDecipheriv(AES_256_GCM, key, iv);
  decipher.setAuthTag(tag);
  const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const parsed: unknown = JSON.parse(plainText);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid decrypted credentials.');
  }
  const result: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(parsed)) {
    if (typeof entryValue === 'string') {
      result[entryKey] = entryValue;
    }
  }
  return result;
}

/**
 * Encrypts email provider secrets using {@link process.env.EMAIL_CREDENTIALS_MASTER_KEY}.
 */
export function encryptEmailCredentials(plain: PaymentGatewayCredentialsPlain): EncryptedCredentialBlob {
  const key = resolveEmailMasterKey();
  if (key === null) {
    throw new Error('EMAIL_CREDENTIALS_MASTER_KEY is not configured (min 32 characters).');
  }
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_256_GCM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: tag.toString('base64url'),
  };
}

/**
 * Decrypts blobs written with the email master key. Falls back to {@link decryptPaymentCredentials}
 * when the email key is unset or the blob was written before the email-specific key existed.
 */
export function decryptEmailCredentials(blob: EncryptedCredentialBlob): PaymentGatewayCredentialsPlain {
  const emailKey = resolveEmailMasterKey();
  if (emailKey !== null) {
    try {
      return decryptWithKey(blob, emailKey);
    } catch {
      // Legacy: blobs encrypted with PAYMENT_CREDENTIALS_MASTER_KEY only.
    }
  }
  return decryptPaymentCredentials(blob);
}
