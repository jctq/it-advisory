import { describe, expect, it, vi } from 'vitest';
import {
  appendTurnstileTokenToBody,
  TURNSTILE_CLIENT_UNAVAILABLE_MESSAGE,
} from './append-turnstile-token';

describe('appendTurnstileTokenToBody', () => {
  it('returns the body unchanged when Turnstile is not configured', async () => {
    const body = { initialPrompt: 'test' };
    const actual = await appendTurnstileTokenToBody({
      body,
      isTurnstileConfigured: false,
      requestToken: vi.fn(async () => 'token'),
    });
    expect(actual).toEqual(body);
  });

  it('adds turnstileToken when a token is returned', async () => {
    const actual = await appendTurnstileTokenToBody({
      body: { initialPrompt: 'test' },
      isTurnstileConfigured: true,
      requestToken: vi.fn(async () => '  abc-token  '),
    });
    expect(actual).toEqual({ initialPrompt: 'test', turnstileToken: 'abc-token' });
  });

  it('throws when Turnstile is configured but no token is available', async () => {
    await expect(
      appendTurnstileTokenToBody({
        body: { initialPrompt: 'test' },
        isTurnstileConfigured: true,
        requestToken: vi.fn(async () => null),
      }),
    ).rejects.toThrow(TURNSTILE_CLIENT_UNAVAILABLE_MESSAGE);
  });
});
