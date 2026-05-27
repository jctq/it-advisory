'use client';

import type { ReactElement, ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MarketingCookieConsentStoreHydrator } from '@/components/marketing/cookie-consent/marketing-cookie-consent-store-hydrator';
import type { CookieConsentDraft, CookieConsentRecord } from '@/lib/marketing/cookie-consent';
import {
  selectMarketingCookieConsentView,
  useMarketingCookieConsentStore,
} from '@/store/marketing/marketing-cookie-consent-store';

export type MarketingCookieConsentContextValue = {
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

type MarketingCookieConsentProviderProps = {
  readonly children: ReactNode;
};

export function MarketingCookieConsentProvider(props: MarketingCookieConsentProviderProps): ReactElement {
  return (
    <MarketingCookieConsentStoreHydrator>
      {props.children}
    </MarketingCookieConsentStoreHydrator>
  );
}

export function useMarketingCookieConsent(): MarketingCookieConsentContextValue {
  return useMarketingCookieConsentStore(useShallow(selectMarketingCookieConsentView));
}
