import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRateLimitDisabled } from './is-rate-limit-disabled';

describe('isRateLimitDisabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when the flag is unset', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isRateLimitDisabled()).toBe(false);
  });

  it('is true in development when RATE_LIMIT_DISABLED=1', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RATE_LIMIT_DISABLED', '1');
    expect(isRateLimitDisabled()).toBe(true);
  });

  it('is false in production even when RATE_LIMIT_DISABLED=1', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_DISABLED', '1');
    expect(isRateLimitDisabled()).toBe(false);
  });
});
