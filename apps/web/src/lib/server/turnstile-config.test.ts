import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTurnstileConfigured, readTurnstileSiteKey } from './turnstile-config';

describe('turnstile config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled when either key is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key');
    expect(isTurnstileConfigured()).toBe(false);
    vi.unstubAllEnvs();
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key');
    expect(isTurnstileConfigured()).toBe(false);
  });

  it('is enabled when both keys are set', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key');
    expect(isTurnstileConfigured()).toBe(true);
    expect(readTurnstileSiteKey()).toBe('site-key');
  });
});
