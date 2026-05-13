/**
 * Restricts open redirects after auth: only same-origin relative paths are allowed.
 */
export function resolveSafeInternalNextPath(raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) {
    return '/';
  }
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/';
  }
  return raw;
}
