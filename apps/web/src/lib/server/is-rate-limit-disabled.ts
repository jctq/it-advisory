import { isProductionNodeEnv } from '@/lib/server/is-production-node-env';

/**
 * When true, rate limiting is skipped (`assertRateLimit` is a no-op).
 * Set `RATE_LIMIT_DISABLED=1` in `.env.local`; ignored when `NODE_ENV` is production.
 */
export function isRateLimitDisabled(): boolean {
  return !isProductionNodeEnv() && process.env.RATE_LIMIT_DISABLED?.trim() === '1';
}
