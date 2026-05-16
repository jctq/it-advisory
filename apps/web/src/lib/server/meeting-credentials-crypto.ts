import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { EncryptedCredentialBlob, PaymentGatewayCredentialsPlain } from '@/domain/payment-types';

const AES_256_GCM = 'aes-256-gcm' as const;
const IV_LENGTH_BYTES = 12 as const;
const AUTH_TAG_LENGTH_BYTES = 16 as const;
const MIN_MASTER_KEY_LENGTH = 32 as const;

function resolveMeetingsMasterKey(): Buffer | null {
  const raw = process.env.MEETINGS_CREDENTIALS_MASTER_KEY?.trim() ?? '';
  if (raw.length < MIN_MASTER_KEY_LENGTH) {
    return null;
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function canEncryptMeetingCredentials(): boolean {
  return resolveMeetingsMasterKey() !== null;
}

export function encryptMeetingCredentials(plain: PaymentGatewayCredentialsPlain): EncryptedCredentialBlob {
  const key = resolveMeetingsMasterKey();
  if (key === null) {
    throw new Error('MEETINGS_CREDENTIALS_MASTER_KEY is not configured (min 32 characters).');
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

export function decryptMeetingCredentials(blob: EncryptedCredentialBlob): PaymentGatewayCredentialsPlain {
  const key = resolveMeetingsMasterKey();
  if (key === null) {
    throw new Error('MEETINGS_CREDENTIALS_MASTER_KEY is not configured.');
  }
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
