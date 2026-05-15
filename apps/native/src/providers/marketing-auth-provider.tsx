import { MarketingAuthApiClient, type MarketingAuthUser } from '@techmd/api-client/marketing-auth-api-client';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { readOrCreateDeviceId } from '../lib/device-id';
import { readNativeAppConfig } from '../lib/native-app-config';

const MARKETING_SESSION_KEY = 'techmd-marketing-auth-session';

type MarketingAuthContextValue = {
  readonly deviceId: string | null;
  readonly user: MarketingAuthUser | null;
  readonly sessionToken: string | null;
  readonly isReady: boolean;
  readonly executeLogin: (email: string, password: string) => Promise<void>;
  readonly executeRegister: (email: string, password: string) => Promise<void>;
  readonly executeLogout: () => Promise<void>;
};

const MarketingAuthContext = createContext<MarketingAuthContextValue | null>(null);

/**
 * Persists marketing Bearer sessions for native and exposes optional account actions.
 */
export function MarketingAuthProvider(props: PropsWithChildren): ReactNode {
  const config = useMemo(() => readNativeAppConfig(), []);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<MarketingAuthUser | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function bootstrap(): Promise<void> {
      try {
        const nextDeviceId = await readOrCreateDeviceId();
        const storedToken = await SecureStore.getItemAsync(MARKETING_SESSION_KEY);
        const nextToken = storedToken !== null && storedToken.length > 0 ? storedToken : null;
        let nextUser: MarketingAuthUser | null = null;
        let validatedToken: string | null = nextToken;
        if (nextToken !== null) {
          const client = new MarketingAuthApiClient({
            apiOrigin: config.apiBaseUrl,
            deviceId: nextDeviceId,
          });
          try {
            const me = await client.fetchMe(nextToken);
            if (me.user === null) {
              validatedToken = null;
              await SecureStore.deleteItemAsync(MARKETING_SESSION_KEY);
            } else {
              nextUser = me.user;
            }
          } catch {
            validatedToken = null;
            await SecureStore.deleteItemAsync(MARKETING_SESSION_KEY);
          }
        }
        if (!isMounted) {
          return;
        }
        setDeviceId(nextDeviceId);
        setSessionToken(validatedToken);
        setUser(nextUser);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }
    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, [config.apiBaseUrl]);

  const executeLogin = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (deviceId === null) {
        throw new Error('The app is still starting up.');
      }
      const client = new MarketingAuthApiClient({
        apiOrigin: config.apiBaseUrl,
        deviceId,
      });
      const result = await client.login({ email, password, mergeGuestProgress: true });
      await SecureStore.setItemAsync(MARKETING_SESSION_KEY, result.sessionToken);
      setSessionToken(result.sessionToken);
      setUser(result.user);
    },
    [config.apiBaseUrl, deviceId],
  );

  const executeRegister = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (deviceId === null) {
        throw new Error('The app is still starting up.');
      }
      const client = new MarketingAuthApiClient({
        apiOrigin: config.apiBaseUrl,
        deviceId,
      });
      const result = await client.register({ email, password, mergeGuestProgress: true });
      await SecureStore.setItemAsync(MARKETING_SESSION_KEY, result.sessionToken);
      setSessionToken(result.sessionToken);
      setUser(result.user);
    },
    [config.apiBaseUrl, deviceId],
  );

  const executeLogout = useCallback(async (): Promise<void> => {
    if (deviceId === null || sessionToken === null) {
      setSessionToken(null);
      setUser(null);
      try {
        await SecureStore.deleteItemAsync(MARKETING_SESSION_KEY);
      } catch {
        /* noop */
      }
      return;
    }
    const client = new MarketingAuthApiClient({
      apiOrigin: config.apiBaseUrl,
      deviceId,
    });
    try {
      await client.logout(sessionToken);
    } finally {
      try {
        await SecureStore.deleteItemAsync(MARKETING_SESSION_KEY);
      } catch {
        /* key may already be absent */
      }
      setSessionToken(null);
      setUser(null);
    }
  }, [config.apiBaseUrl, deviceId, sessionToken]);

  const value = useMemo<MarketingAuthContextValue>(
    () => ({
      deviceId,
      user,
      sessionToken,
      isReady,
      executeLogin,
      executeRegister,
      executeLogout,
    }),
    [deviceId, user, sessionToken, isReady, executeLogin, executeRegister, executeLogout],
  );

  return <MarketingAuthContext.Provider value={value}>{props.children}</MarketingAuthContext.Provider>;
}

export function useMarketingAuth(): MarketingAuthContextValue {
  const ctx = useContext(MarketingAuthContext);
  if (ctx === null) {
    throw new Error('useMarketingAuth must be used within MarketingAuthProvider.');
  }
  return ctx;
}
