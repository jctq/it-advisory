/**
 * Cloudflare Turnstile configuration (optional bot challenge).
 */
export function readTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
}

export function readTurnstileSecretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? '';
}

export function isTurnstileConfigured(): boolean {
  return readTurnstileSiteKey().length > 0 && readTurnstileSecretKey().length > 0;
}
