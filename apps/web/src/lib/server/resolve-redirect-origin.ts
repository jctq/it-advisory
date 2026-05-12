import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';

/**
 * Base URL origin for same-origin redirects (e.g. post-login `Location`).
 * Prefers `NEXT_PUBLIC_APP_URL` so local/dev matches the URL you configure (avoids wrong ports from `request.url`
 * behind proxies or tooling). Then `x-forwarded-*`, then the incoming request URL.
 */
export function resolveRedirectOrigin(request: Request): string {
  const configuredOrigin = resolveConfiguredAppOrigin();
  if (configuredOrigin !== null) {
    return configuredOrigin;
  }
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim();
    if (host && host.length > 0) {
      const protoRaw = forwardedProto?.split(',')[0]?.trim().toLowerCase();
      const proto = protoRaw === 'http' || protoRaw === 'https' ? protoRaw : 'http';
      return `${proto}://${host}`;
    }
  }
  return new URL(request.url).origin;
}
