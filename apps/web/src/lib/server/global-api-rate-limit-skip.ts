/**
 * API paths excluded from the coarse global rate limit in `proxy.ts`.
 */
const GLOBAL_API_RATE_LIMIT_SKIP_PREFIXES: readonly string[] = [
  '/api/webhooks/',
  '/api/auth/',
  '/api/cron/',
  '/api/health',
];

export function shouldSkipGlobalApiRateLimit(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) {
    return true;
  }
  return GLOBAL_API_RATE_LIMIT_SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
