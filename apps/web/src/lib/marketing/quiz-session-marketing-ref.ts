/**
 * Client-safe helpers for marketing quiz session refs in URLs (`/diagnostic/[sessionRef]`, `/book/[sessionRef]`, and legacy `?sessionId=`).
 * Opaque refs use {@link MARKETING_QUIZ_SESSION_REF_PREFIX}; legacy URLs may still use a raw Mongo ObjectId hex string.
 */
export const MARKETING_QUIZ_SESSION_REF_PREFIX = 'qs1.' as const;

/**
 * Returns true when the value is either a 24-char ObjectId hex or an opaque marketing ref produced by the server.
 */
export function isPlausibleMarketingQuizSessionRef(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 512) {
    return false;
  }
  if (/^[a-f\d]{24}$/i.test(trimmed)) {
    return true;
  }
  if (!trimmed.startsWith(MARKETING_QUIZ_SESSION_REF_PREFIX)) {
    return false;
  }
  const suffix = trimmed.slice(MARKETING_QUIZ_SESSION_REF_PREFIX.length);
  return suffix.length >= 32 && /^[A-Za-z0-9_-]+$/.test(suffix);
}

/**
 * Path for a targeted marketing quiz session (opaque token or legacy ObjectId hex).
 */
export function buildMarketingQuizSessionPath(sessionRef: string): string {
  return `/diagnostic/${encodeURIComponent(sessionRef.trim())}`;
}

/**
 * Path to retake the diagnostic, optionally scoped to a persisted session row.
 */
export function buildMarketingQuizRetakePath(sessionRef: string | null): string {
  if (sessionRef === null) {
    return '/diagnostic?retake=1';
  }
  return `${buildMarketingQuizSessionPath(sessionRef)}?retake=1`;
}

/**
 * Path for booking checkout scoped to a quiz diagnostic row (same ref shape as quiz paths).
 */
export function buildMarketingBookSessionPath(sessionRef: string, serviceKey?: string | null): string {
  const base = `/book/${encodeURIComponent(sessionRef.trim())}`;
  const key = typeof serviceKey === 'string' ? serviceKey.trim() : '';
  if (key.length === 0) {
    return base;
  }
  return `${base}?serviceKey=${encodeURIComponent(key)}`;
}
