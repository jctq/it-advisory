import { describe, expect, it } from 'vitest';
import { shouldSkipGlobalApiRateLimit } from './global-api-rate-limit-skip';

describe('global api rate limit skip', () => {
  it('skips non-api paths', () => {
    expect(shouldSkipGlobalApiRateLimit('/diagnostic')).toBe(true);
  });

  it('skips webhooks and auth callbacks', () => {
    expect(shouldSkipGlobalApiRateLimit('/api/webhooks/paymongo')).toBe(true);
    expect(shouldSkipGlobalApiRateLimit('/api/auth/callback/google')).toBe(true);
    expect(shouldSkipGlobalApiRateLimit('/api/cron/payment-holds')).toBe(true);
    expect(shouldSkipGlobalApiRateLimit('/api/health')).toBe(true);
  });

  it('applies global limit to public api routes', () => {
    expect(shouldSkipGlobalApiRateLimit('/api/booking/availability')).toBe(false);
    expect(shouldSkipGlobalApiRateLimit('/api/diagnostic/diagnostic-round')).toBe(false);
  });
});
