import { timingSafeEqual } from 'node:crypto';

/**
 * Machine-to-machine admin API token (`ADMIN_SERVICE_TOKEN`, legacy `ADMIN_TOKEN` alias).
 */
export function readAdminServiceToken(): string {
  return process.env.ADMIN_SERVICE_TOKEN?.trim() ?? process.env.ADMIN_TOKEN?.trim() ?? '';
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Validates `Authorization: Bearer` for scripted admin API access.
 */
export function isValidAdminServiceBearer(authHeader: string | null): boolean {
  const expected = readAdminServiceToken();
  if (expected.length === 0 || authHeader === null) {
    return false;
  }
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return false;
  }
  const token = authHeader.slice('bearer '.length).trim();
  return token.length > 0 && constantTimeEquals(token, expected);
}
