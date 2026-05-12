const API_BASE_URL_ENV_NAME = 'NEXT_PUBLIC_API_BASE_URL';

/**
 * Returns the public API origin override when a wrapper should target a hosted app explicitly.
 */
export function resolveConfiguredApiOrigin(): string | null {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredApiUrl === undefined || configuredApiUrl.length === 0) {
    return null;
  }
  try {
    return new URL(configuredApiUrl).origin;
  } catch {
    console.warn(`Ignoring invalid ${API_BASE_URL_ENV_NAME}: ${configuredApiUrl}`);
    return null;
  }
}
