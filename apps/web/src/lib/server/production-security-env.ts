import { listAdminAllowedEmails } from '@/lib/server/admin-allowed-emails';
import { isProductionNodeEnv } from '@/lib/server/is-production-node-env';

const MIN_AUTH_SECRET_LENGTH = 32 as const;
const MIN_CRON_SECRET_LENGTH = 16 as const;
const MIN_MASTER_KEY_LENGTH = 32 as const;
const MIN_OPAQUE_SECRET_LENGTH = 16 as const;

function readTrimmedEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function assertMinLength(errors: string[], name: string, value: string, minLength: number): void {
  if (value.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters in production.`);
  }
}

function assertHttpsAppUrl(errors: string[]): void {
  const raw = readTrimmedEnv('NEXT_PUBLIC_APP_URL');
  if (raw.length === 0) {
    errors.push('NEXT_PUBLIC_APP_URL is required in production.');
    return;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') {
      errors.push('NEXT_PUBLIC_APP_URL must use https:// in production.');
    }
  } catch {
    errors.push('NEXT_PUBLIC_APP_URL must be a valid URL in production.');
  }
}

function assertAdminOAuthConfigured(errors: string[]): void {
  const googleId = readTrimmedEnv('AUTH_GOOGLE_ID');
  const googleSecret = readTrimmedEnv('AUTH_GOOGLE_SECRET');
  const microsoftId = readTrimmedEnv('AUTH_MICROSOFT_ENTRA_ID_ID');
  const microsoftSecret = readTrimmedEnv('AUTH_MICROSOFT_ENTRA_ID_SECRET');
  const hasGoogle = googleId.length > 0 && googleSecret.length > 0;
  const hasMicrosoft = microsoftId.length > 0 && microsoftSecret.length > 0;
  if (!hasGoogle && !hasMicrosoft) {
    errors.push('Configure at least one admin OAuth provider (Google or Microsoft Entra ID).');
  }
}

/**
 * Validates required production secrets at process startup. Throws when misconfigured.
 */
export function assertProductionSecurityEnv(): void {
  if (!isProductionNodeEnv()) {
    return;
  }
  const errors: string[] = [];
  assertMinLength(errors, 'AUTH_SECRET', readTrimmedEnv('AUTH_SECRET'), MIN_AUTH_SECRET_LENGTH);
  if (listAdminAllowedEmails().length === 0) {
    errors.push('ADMIN_ALLOWED_EMAILS must list at least one allowlisted admin email.');
  }
  assertAdminOAuthConfigured(errors);
  assertMinLength(errors, 'CRON_SECRET', readTrimmedEnv('CRON_SECRET'), MIN_CRON_SECRET_LENGTH);
  if (readTrimmedEnv('MONGODB_URI').length === 0) {
    errors.push('MONGODB_URI is required in production.');
  }
  assertHttpsAppUrl(errors);
  assertMinLength(
    errors,
    'PAYMENT_CREDENTIALS_MASTER_KEY',
    readTrimmedEnv('PAYMENT_CREDENTIALS_MASTER_KEY'),
    MIN_MASTER_KEY_LENGTH,
  );
  assertMinLength(
    errors,
    'EMAIL_CREDENTIALS_MASTER_KEY',
    readTrimmedEnv('EMAIL_CREDENTIALS_MASTER_KEY'),
    MIN_MASTER_KEY_LENGTH,
  );
  assertMinLength(
    errors,
    'MEETINGS_CREDENTIALS_MASTER_KEY',
    readTrimmedEnv('MEETINGS_CREDENTIALS_MASTER_KEY'),
    MIN_MASTER_KEY_LENGTH,
  );
  assertMinLength(
    errors,
    'DIAGNOSTIC_SESSION_URL_SECRET',
    readTrimmedEnv('DIAGNOSTIC_SESSION_URL_SECRET'),
    MIN_OPAQUE_SECRET_LENGTH,
  );
  assertMinLength(
    errors,
    'BOOKING_SESSION_ACCESS_SECRET',
    readTrimmedEnv('BOOKING_SESSION_ACCESS_SECRET'),
    MIN_OPAQUE_SECRET_LENGTH,
  );
  if (errors.length > 0) {
    throw new Error(`Production security environment misconfigured:\n- ${errors.join('\n- ')}`);
  }
}
