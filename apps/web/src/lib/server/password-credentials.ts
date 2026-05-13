import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEY_LENGTH_BYTES = 64;
const SCRYPT_SALT_LENGTH_BYTES = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const STORED_PREFIX = 'v1' as const;

/**
 * Creates a salted scrypt hash suitable for storing on `UserAccountDocument.passwordHash`.
 */
export function hashPasswordPlain(plainPassword: string): string {
  const salt = randomBytes(SCRYPT_SALT_LENGTH_BYTES);
  const derivedKey = scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH_BYTES, SCRYPT_OPTIONS);
  return `${STORED_PREFIX}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored `hashPasswordPlain` value.
 */
export function verifyPasswordPlain(plainPassword: string, storedHash: string): boolean {
  const segments = storedHash.split('$');
  if (segments.length !== 3 || segments[0] !== STORED_PREFIX) {
    return false;
  }
  const saltHex = segments[1];
  const expectedHex = segments[2];
  if (saltHex === undefined || expectedHex === undefined) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(expectedHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length !== SCRYPT_SALT_LENGTH_BYTES || expected.length !== SCRYPT_KEY_LENGTH_BYTES) {
    return false;
  }
  const actual = scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH_BYTES, SCRYPT_OPTIONS);
  return timingSafeEqual(actual, expected);
}
