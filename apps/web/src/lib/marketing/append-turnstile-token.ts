export const TURNSTILE_CLIENT_UNAVAILABLE_MESSAGE =
  'Security check timed out or failed. Refresh the page and try again.';

/**
 * Adds a Turnstile token to an API request body when bot challenge is configured.
 */
export async function appendTurnstileTokenToBody(input: {
  readonly body: Record<string, unknown>;
  readonly isTurnstileConfigured: boolean;
  readonly requestToken: () => Promise<string | null>;
}): Promise<Record<string, unknown>> {
  if (!input.isTurnstileConfigured) {
    return input.body;
  }
  const token = await input.requestToken();
  if (token === null || token.trim().length === 0) {
    throw new Error(TURNSTILE_CLIENT_UNAVAILABLE_MESSAGE);
  }
  return { ...input.body, turnstileToken: token.trim() };
}
