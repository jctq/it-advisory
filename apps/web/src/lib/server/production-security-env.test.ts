import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionSecurityEnv } from './production-security-env';

function stubProductionOAuthEnv(): void {
  vi.stubEnv('AUTH_SECRET', 's'.repeat(32));
  vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'admin@example.com');
  vi.stubEnv('AUTH_GOOGLE_ID', 'google-client-id');
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'google-client-secret');
  vi.stubEnv('CRON_SECRET', 'c'.repeat(16));
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
  vi.stubEnv('PAYMENT_CREDENTIALS_MASTER_KEY', 'p'.repeat(32));
  vi.stubEnv('EMAIL_CREDENTIALS_MASTER_KEY', 'e'.repeat(32));
  vi.stubEnv('MEETINGS_CREDENTIALS_MASTER_KEY', 'm'.repeat(32));
  vi.stubEnv('DIAGNOSTIC_SESSION_URL_SECRET', 'd'.repeat(16));
  vi.stubEnv('BOOKING_SESSION_ACCESS_SECRET', 'b'.repeat(16));
}

describe('assertProductionSecurityEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not throw outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => assertProductionSecurityEnv()).not.toThrow();
  });

  it('throws in production when required secrets are missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', '');
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('MONGODB_URI', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(() => assertProductionSecurityEnv()).toThrow(/Production security environment misconfigured/);
  });

  it('passes when production secrets meet minimum requirements', () => {
    vi.stubEnv('NODE_ENV', 'production');
    stubProductionOAuthEnv();
    expect(() => assertProductionSecurityEnv()).not.toThrow();
  });
});
