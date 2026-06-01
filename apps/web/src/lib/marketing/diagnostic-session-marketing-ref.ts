/**
 * Client-safe helpers for marketing diagnostic session refs in URLs (`/diagnostic/[sessionRef]`, `/book/[sessionRef]`, and legacy `?sessionId=`).
 * Opaque refs use {@link MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX}; legacy URLs may still use a raw Mongo ObjectId hex string.
 */
export const MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX = 'ds1.' as const;

/** Pre-rename opaque URL prefix; still accepted when resolving session refs. */
export const LEGACY_MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX = 'qs1.' as const;

function resolveMarketingDiagnosticSessionRefPrefix(ref: string): string | null {
  const trimmed = ref.trim();
  if (trimmed.startsWith(MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX)) {
    return MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX;
  }
  if (trimmed.startsWith(LEGACY_MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX)) {
    return LEGACY_MARKETING_DIAGNOSTIC_SESSION_REF_PREFIX;
  }
  return null;
}

/**
 * Returns true when the value is either a 24-char ObjectId hex or an opaque marketing ref produced by the server.
 */
export function isPlausibleMarketingDiagnosticSessionRef(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 512) {
    return false;
  }
  if (/^[a-f\d]{24}$/i.test(trimmed)) {
    return true;
  }
  const prefix = resolveMarketingDiagnosticSessionRefPrefix(trimmed);
  if (prefix === null) {
    return false;
  }
  const suffix = trimmed.slice(prefix.length);
  return suffix.length >= 32 && /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Path for a targeted marketing diagnostic session (opaque token or legacy ObjectId hex).
 */
export function buildMarketingDiagnosticSessionPath(sessionRef: string): string {
  return `/diagnostic/${encodeURIComponent(sessionRef.trim())}`;
}

/**
 * Path to retake the diagnostic, optionally scoped to a persisted session row.
 */
export function buildMarketingDiagnosticRetakePath(sessionRef: string | null): string {
  if (sessionRef === null) {
    return '/diagnostic?retake=1';
  }
  return `${buildMarketingDiagnosticSessionPath(sessionRef)}?retake=1`;
}

/**
 * Path for booking checkout scoped to a diagnostic session row (same ref shape as diagnostic paths).
 */
export function buildMarketingBookSessionPath(sessionRef: string, serviceKey?: string | null): string {
  const base = `/book/${encodeURIComponent(sessionRef.trim())}`;
  const key = typeof serviceKey === 'string' ? serviceKey.trim() : '';
  if (key.length === 0) {
    return base;
  }
  return `${base}?serviceKey=${encodeURIComponent(key)}`;
}

export type MarketingBookCheckoutResumeStep = 'details' | 'payment';

/** Booking checkout URL after manage-booking reschedule (defers payment hold until Pay). */
export function buildMarketingBookSessionCheckoutResumePath(
  sessionRef: string,
  input: {
    readonly checkoutStep: MarketingBookCheckoutResumeStep;
    readonly serviceKey?: string | null;
  },
): string {
  const base = buildMarketingBookSessionPath(sessionRef, input.serviceKey);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}checkoutStep=${input.checkoutStep}&deferPaymentHold=1`;
}
