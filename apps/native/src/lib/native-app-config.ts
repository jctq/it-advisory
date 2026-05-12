type NativeAppConfig = {
  readonly apiBaseUrl: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

/**
 * Reads public runtime configuration exposed through Expo environment variables.
 */
export function readNativeAppConfig(): NativeAppConfig {
  const apiBaseUrl = normalizeOrigin(process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL);
  return {
    apiBaseUrl,
  };
}
