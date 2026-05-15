/**
 * Resolves the public site base URL used for payment success/cancel redirects.
 * Optional client-provided base (e.g. native app’s EXPO_PUBLIC_API_BASE_URL) is accepted
 * when it matches this request’s origin, NEXT_PUBLIC_APP_URL, or CHECKOUT_ALLOWED_APP_BASE_URLS.
 */

function normalizeAppBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function tryParseOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function readAllowedCheckoutOriginsFromEnv(): readonly string[] {
  const raw = process.env.CHECKOUT_ALLOWED_APP_BASE_URLS?.trim();
  if (raw === undefined || raw.length === 0) {
    return [];
  }
  const origins: string[] = [];
  for (const part of raw.split(',')) {
    const origin = tryParseOrigin(normalizeAppBaseUrl(part));
    if (origin !== null) {
      origins.push(origin);
    }
  }
  return origins;
}

/**
 * Default base URL for redirects when the client does not supply a validated override.
 */
export function resolveAppBaseUrlFromRequest(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return normalizeAppBaseUrl(configured);
  }
  return normalizeAppBaseUrl(new URL(request.url).origin);
}

/**
 * Effective base URL for PSP success/cancel URLs; prefers a validated client override.
 */
export function resolveCheckoutAppBaseUrl(request: Request, clientAppBaseUrl?: string | null): string {
  const fallback = resolveAppBaseUrlFromRequest(request);
  if (clientAppBaseUrl === undefined || clientAppBaseUrl === null) {
    return fallback;
  }
  const normalized = normalizeAppBaseUrl(clientAppBaseUrl);
  if (normalized.length === 0) {
    return fallback;
  }
  const clientOrigin = tryParseOrigin(normalized);
  if (clientOrigin === null) {
    return fallback;
  }
  const requestOrigin = new URL(request.url).origin;
  if (clientOrigin === requestOrigin) {
    return normalized;
  }
  const envConfigured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envConfigured !== undefined && envConfigured.length > 0) {
    const envOrigin = tryParseOrigin(normalizeAppBaseUrl(envConfigured));
    if (envOrigin !== null && clientOrigin === envOrigin) {
      return normalized;
    }
  }
  const allowedOrigins = readAllowedCheckoutOriginsFromEnv();
  if (allowedOrigins.includes(clientOrigin)) {
    return normalized;
  }
  return fallback;
}
