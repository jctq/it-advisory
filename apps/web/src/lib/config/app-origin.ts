const APP_URL_ENV_NAME = 'NEXT_PUBLIC_APP_URL';

/**
 * Returns the canonical public origin for the hosted app when configured.
 * This keeps redirects, metadata, and external shells pointed at one URL.
 */
export function resolveConfiguredAppOrigin(): string | null {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl === undefined || configuredAppUrl.length === 0) {
    return null;
  }
  try {
    return new URL(configuredAppUrl).origin;
  } catch {
    console.warn(`Ignoring invalid ${APP_URL_ENV_NAME}: ${configuredAppUrl}`);
    return null;
  }
}
