import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyCronRequest } from './verify-cron-request';

describe('verifyCronRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows requests in development when CRON_SECRET is unset', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CRON_SECRET', '');
    const result = verifyCronRequest(new Request('https://example.com/api/cron/payment-holds'));
    expect(result).toEqual({ authorized: true });
  });

  it('denies requests in production when CRON_SECRET is unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', '');
    const result = verifyCronRequest(new Request('https://example.com/api/cron/payment-holds'));
    expect(result).toEqual({ authorized: false });
  });

  it('requires a matching bearer token when CRON_SECRET is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    const unauthorized = verifyCronRequest(new Request('https://example.com/api/cron/payment-holds'));
    expect(unauthorized).toEqual({ authorized: false });
    const authorized = verifyCronRequest(
      new Request('https://example.com/api/cron/payment-holds', {
        headers: { Authorization: 'Bearer cron-test-secret' },
      }),
    );
    expect(authorized).toEqual({ authorized: true });
  });
});
