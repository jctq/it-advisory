import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRateLimitIdentifier, resolveRateLimitPolicy } from './rate-limit-policy';

describe('rate-limit policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns stable auth login limits', () => {
    expect(resolveRateLimitPolicy('auth_login')).toEqual({ limit: 10, windowMs: 15 * 60 * 1000 });
  });

  it('reads diagnostic AI limit from env', () => {
    vi.stubEnv('RATE_LIMIT_DIAGNOSTIC_AI_PER_HOUR', '12');
    expect(resolveRateLimitPolicy('diagnostic_ai')).toEqual({ limit: 12, windowMs: 60 * 60 * 1000 });
  });

  it('prefers forwarded client IP as identifier', () => {
    const identifier = resolveRateLimitIdentifier(
      new Request('https://example.com', {
        headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.1' },
      }),
    );
    expect(identifier).toBe('ip:203.0.113.10');
  });
});
