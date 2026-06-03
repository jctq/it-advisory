import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function readCommaSeparatedOrigins(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }
  const origins: string[] = [];
  for (const part of raw.split(',')) {
    const origin = normalizeOrigin(part);
    if (origin !== null) {
      origins.push(origin);
    }
  }
  return origins;
}

/**
 * Origins allowed to call support APIs from browsers or native wrappers.
 */
export function listSupportCorsAllowedOrigins(): readonly string[] {
  const allowed = new Set<string>();
  const configured = resolveConfiguredAppOrigin();
  if (configured !== null) {
    allowed.add(configured);
  }
  for (const origin of readCommaSeparatedOrigins(process.env.CHECKOUT_ALLOWED_APP_BASE_URLS)) {
    allowed.add(origin);
  }
  for (const origin of readCommaSeparatedOrigins(process.env.SUPPORT_CORS_EXTRA_ORIGINS)) {
    allowed.add(origin);
  }
  return [...allowed];
}

function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.includes(origin);
}

/**
 * CORS headers for support routes; only echoes allowlisted origins.
 */
export function buildSupportCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin')?.trim() ?? '';
  if (origin.length === 0) {
    return headers;
  }
  const normalized = normalizeOrigin(origin);
  if (normalized === null) {
    return headers;
  }
  if (!isOriginAllowed(normalized, listSupportCorsAllowedOrigins())) {
    return headers;
  }
  headers.set('Access-Control-Allow-Origin', normalized);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, Authorization');
  return headers;
}
