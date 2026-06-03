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
    return input.body;
  }
  return { ...input.body, turnstileToken: token.trim() };
}
