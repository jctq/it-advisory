/** Fallback when {@link process.env.SITE_NAME} and admin override are unset. */
export const DEFAULT_SITE_NAME = 'TeqMD' as const;

/**
 * Site name from environment (`SITE_NAME`). Used until overridden in Admin → Settings → General.
 */
export function readEnvSiteName(): string {
  const raw = process.env.SITE_NAME?.trim() ?? '';
  return raw.length > 0 ? raw : DEFAULT_SITE_NAME;
}

/**
 * Resolves the public site name: admin-stored override, then env, then {@link DEFAULT_SITE_NAME}.
 */
export function resolveSiteName(storedOverride: string | undefined): string {
  const custom = storedOverride?.trim() ?? '';
  return custom.length > 0 ? custom : readEnvSiteName();
}
