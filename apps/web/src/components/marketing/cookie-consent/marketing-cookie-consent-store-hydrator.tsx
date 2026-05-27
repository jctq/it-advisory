'use client';

import type { ReactElement, ReactNode } from 'react';
import { useEffect, useSyncExternalStore } from 'react';
import { getCookieConsentSnapshot, subscribeCookieConsent } from '@/lib/marketing/cookie-consent';
import { ensureGtagConsentDefaults } from '@/lib/marketing/google-analytics';
import {
  activateAnalyticsIfConsented,
  useMarketingCookieConsentStore,
} from '@/store/marketing/marketing-cookie-consent-store';

function readServerCookieConsentSnapshot(): null {
  return null;
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

type MarketingCookieConsentStoreHydratorProps = {
  readonly children: ReactNode;
};

/**
 * Syncs cookie consent storage and client mount into the marketing Zustand store.
 */
export function MarketingCookieConsentStoreHydrator(props: MarketingCookieConsentStoreHydratorProps): ReactElement {
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
  const syncConsent = useMarketingCookieConsentStore((state) => state.syncConsent);
  const setClientMounted = useMarketingCookieConsentStore((state) => state.setClientMounted);
  useEffect(() => {
    ensureGtagConsentDefaults();
  }, []);
  useEffect(() => {
    syncConsent(consent);
  }, [consent, syncConsent]);
  useEffect(() => {
    setClientMounted(isClientMounted);
  }, [isClientMounted, setClientMounted]);
  useEffect(() => {
    activateAnalyticsIfConsented(consent, isClientMounted);
  }, [consent, isClientMounted]);
  return <>{props.children}</>;
}
