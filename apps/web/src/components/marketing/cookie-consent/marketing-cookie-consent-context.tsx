'use client';

import {
  buildCookieConsentRecord,
  hasAnalyticsConsent,
  getCookieConsentSnapshot,
  subscribeCookieConsent,
  writeCookieConsentToStorage,
  type CookieConsentDraft,
  type CookieConsentRecord,
} from '@/lib/marketing/cookie-consent';
import {
  activateGoogleAnalytics,
  ensureGtagConsentDefaults,
  resolveGoogleAnalyticsMeasurementId,
  updateGtagAnalyticsConsent,
} from '@/lib/marketing/google-analytics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

type MarketingCookieConsentContextValue = {
  readonly consent: CookieConsentRecord | null;
  readonly isBannerVisible: boolean;
  readonly isPreferencesOpen: boolean;
  readonly draft: CookieConsentDraft;
  readonly setDraftAnalytics: (enabled: boolean) => void;
  readonly openPreferences: () => void;
  readonly closePreferences: () => void;
  readonly acceptAll: () => void;
  readonly acceptEssentialOnly: () => void;
  readonly saveCustomPreferences: () => void;
  readonly dismissBanner: () => void;
};

const MarketingCookieConsentContext = createContext<MarketingCookieConsentContextValue | null>(null);
const CONSENT_LOG_PREFIX = '[TechMD Cookie Consent]';

function readServerCookieConsentSnapshot(): CookieConsentRecord | null {
  return null;
}

function logConsentEvent(message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.info(`${CONSENT_LOG_PREFIX} ${message}`);
    return;
  }
  console.info(`${CONSENT_LOG_PREFIX} ${message}`, payload);
}

function applyConsent(record: CookieConsentRecord): void {
  logConsentEvent('Applying consent record', record);
  writeCookieConsentToStorage(record);
  ensureGtagConsentDefaults();
  if (!hasAnalyticsConsent(record)) {
    logConsentEvent('Consent denies analytics, updating GA consent to denied');
    updateGtagAnalyticsConsent(false);
  }
}

function subscribeClientMounted(onStoreChange: () => void): () => void {
  onStoreChange();
  return () => undefined;
}

function readClientMountedSnapshot(): boolean {
  return true;
}

function readServerMountedSnapshot(): boolean {
  return false;
}

type MarketingCookieConsentProviderProps = {
  readonly children: ReactNode;
};

export function MarketingCookieConsentProvider(props: MarketingCookieConsentProviderProps): ReactElement {
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsentSnapshot,
    readServerCookieConsentSnapshot,
  );
  const isClientMounted = useSyncExternalStore(
    subscribeClientMounted,
    readClientMountedSnapshot,
    readServerMountedSnapshot,
  );
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<CookieConsentDraft>({ analytics: false });
  useEffect(() => {
    ensureGtagConsentDefaults();
    logConsentEvent('Initialized consent defaults on mount');
  }, []);
  useEffect(() => {
    if (!isClientMounted || consent === null) {
      return;
    }
    const measurementId = resolveGoogleAnalyticsMeasurementId();
    logConsentEvent('Observed existing consent snapshot', { consent, measurementId });
    if (hasAnalyticsConsent(consent) && measurementId !== null) {
      logConsentEvent('Snapshot allows analytics, activating GA', { measurementId });
      void activateGoogleAnalytics(measurementId);
      return;
    }
    logConsentEvent('Snapshot denies analytics, updating GA consent to denied');
    updateGtagAnalyticsConsent(false);
  }, [consent, isClientMounted]);
  const persistChoice = useCallback((choice: 'essential-only' | 'all', analytics: boolean) => {
    const record = buildCookieConsentRecord(choice);
    const resolved: CookieConsentRecord = { ...record, analytics };
    applyConsent(resolved);
    setDraft({ analytics: resolved.analytics });
    setIsPreferencesOpen(false);
  }, []);
  const acceptAll = useCallback(() => {
    persistChoice('all', true);
  }, [persistChoice]);
  const acceptEssentialOnly = useCallback(() => {
    persistChoice('essential-only', false);
  }, [persistChoice]);
  const saveCustomPreferences = useCallback(() => {
    if (draft.analytics) {
      persistChoice('all', true);
      return;
    }
    persistChoice('essential-only', false);
  }, [draft.analytics, persistChoice]);
  const openPreferences = useCallback(() => {
    setDraft({ analytics: consent?.analytics ?? false });
    setIsPreferencesOpen(true);
  }, [consent?.analytics]);
  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
  }, []);
  const dismissBanner = useCallback(() => {
    if (consent === null) {
      acceptEssentialOnly();
    }
  }, [acceptEssentialOnly, consent]);
  const setDraftAnalytics = useCallback((enabled: boolean) => {
    setDraft({ analytics: enabled });
  }, []);
  const isBannerVisible = isClientMounted && consent === null && !isPreferencesOpen;
  const value = useMemo<MarketingCookieConsentContextValue>(
    () => ({
      consent,
      isBannerVisible,
      isPreferencesOpen,
      draft,
      setDraftAnalytics,
      openPreferences,
      closePreferences,
      acceptAll,
      acceptEssentialOnly,
      saveCustomPreferences,
      dismissBanner,
    }),
    [
      acceptAll,
      acceptEssentialOnly,
      closePreferences,
      consent,
      dismissBanner,
      draft,
      isBannerVisible,
      isPreferencesOpen,
      openPreferences,
      saveCustomPreferences,
      setDraftAnalytics,
    ],
  );
  return (
    <MarketingCookieConsentContext.Provider value={value}>{props.children}</MarketingCookieConsentContext.Provider>
  );
}

export function useMarketingCookieConsent(): MarketingCookieConsentContextValue {
  const context = useContext(MarketingCookieConsentContext);
  if (context === null) {
    throw new Error('useMarketingCookieConsent must be used within MarketingCookieConsentProvider');
  }
  return context;
}
