import { isProductionNodeEnv } from './is-production-node-env';

export type SecurityHeader = {
  readonly key: string;
  readonly value: string;
};

/**
 * Response headers applied to all routes via `next.config.ts`.
 */
export function buildSecurityHeaders(): readonly SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    { key: 'X-Frame-Options', value: 'DENY' },
  ];
  if (isProductionNodeEnv()) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  }
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '';
  const gaConnect = gaId.length > 0 ? ' https://www.googletagmanager.com https://www.google-analytics.com' : '';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const turnstileScript = turnstileSiteKey.length > 0 ? ' https://challenges.cloudflare.com' : '';
  const turnstileFrame = turnstileSiteKey.length > 0 ? ' https://challenges.cloudflare.com' : '';
  const cspValue = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'" + turnstileScript,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:" + gaConnect,
    "frame-src 'self'" + turnstileFrame,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const enforceCsp = process.env.CSP_ENFORCE?.trim() === '1';
  headers.push({
    key: enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    value: cspValue,
  });
  return headers;
}
