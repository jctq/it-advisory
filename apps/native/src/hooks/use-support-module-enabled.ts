import { useEffect, useState } from 'react';
import { readNativeAppConfig } from './native-app-config';

type DiagnosticConfigResponse = {
  readonly supportModuleEnabled?: boolean;
};

/**
 * Reads whether the public support report module is enabled from the web API.
 */
export function useSupportModuleEnabled(): boolean {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    const config = readNativeAppConfig();
    void fetch(`${config.apiBaseUrl}/api/quiz/diagnostic-config`)
      .then(async (response) => {
        const payload = (await response.json()) as DiagnosticConfigResponse;
        if (!response.ok) {
          return false;
        }
        return payload.supportModuleEnabled === true;
      })
      .then((enabled) => {
        if (!cancelled) {
          setIsEnabled(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return isEnabled;
}
