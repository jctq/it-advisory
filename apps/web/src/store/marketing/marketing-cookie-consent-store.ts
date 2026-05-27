'use client';

import { create } from 'zustand';
import {
  buildCookieConsentRecord,
  hasAnalyticsConsent,
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

export type MarketingCookieConsentState = {
  readonly consent: CookieConsentRecord | null;
  readonly isClientMounted: boolean;
  readonly isPreferencesOpen: boolean;
  readonly draft: CookieConsentDraft;
};

export type MarketingCookieConsentActions = {
  readonly syncConsent: (consent: CookieConsentRecord | null) => void;
  readonly setClientMounted: (isMounted: boolean) => void;
  readonly setDraftAnalytics: (enabled: boolean) => void;
  readonly openPreferences: () => void;
  readonly closePreferences: () => void;
  readonly acceptAll: () => void;
  readonly acceptEssentialOnly: () => void;
  readonly saveCustomPreferences: () => void;
  readonly dismissBanner: () => void;
};

export type MarketingCookieConsentStore = MarketingCookieConsentState & MarketingCookieConsentActions;

function applyConsent(record: CookieConsentRecord): void {
  writeCookieConsentToStorage(record);
  ensureGtagConsentDefaults();
  if (!hasAnalyticsConsent(record)) {
    updateGtagAnalyticsConsent(false);
  }
}

function persistChoice(
  get: () => MarketingCookieConsentStore,
  set: (partial: Partial<MarketingCookieConsentStore>) => void,
  choice: 'essential-only' | 'all',
  analytics: boolean,
): void {
  const record = buildCookieConsentRecord(choice);
  const resolved: CookieConsentRecord = { ...record, analytics };
  applyConsent(resolved);
  set({ draft: { analytics: resolved.analytics }, isPreferencesOpen: false });
}

export const useMarketingCookieConsentStore = create<MarketingCookieConsentStore>((set, get) => ({
  consent: null,
  isClientMounted: false,
  isPreferencesOpen: false,
  draft: { analytics: false },
  syncConsent: (consent): void => {
    set({ consent });
  },
  setClientMounted: (isClientMounted): void => {
    set({ isClientMounted });
  },
  setDraftAnalytics: (enabled): void => {
    set({ draft: { analytics: enabled } });
  },
  openPreferences: (): void => {
    const consent = get().consent;
    set({ draft: { analytics: consent?.analytics ?? false }, isPreferencesOpen: true });
  },
  closePreferences: (): void => {
    set({ isPreferencesOpen: false });
  },
  acceptAll: (): void => {
    persistChoice(get, set, 'all', true);
  },
  acceptEssentialOnly: (): void => {
    persistChoice(get, set, 'essential-only', false);
  },
  saveCustomPreferences: (): void => {
    const draft = get().draft;
    if (draft.analytics) {
      persistChoice(get, set, 'all', true);
      return;
    }
    persistChoice(get, set, 'essential-only', false);
  },
  dismissBanner: (): void => {
    if (get().consent === null) {
      get().acceptEssentialOnly();
    }
  },
}));

export function activateAnalyticsIfConsented(consent: CookieConsentRecord | null, isClientMounted: boolean): void {
  if (!isClientMounted || consent === null) {
    return;
  }
  const measurementId = resolveGoogleAnalyticsMeasurementId();
  if (hasAnalyticsConsent(consent) && measurementId !== null) {
    void activateGoogleAnalytics(measurementId);
    return;
  }
  updateGtagAnalyticsConsent(false);
}

export function selectMarketingCookieConsentView(state: MarketingCookieConsentStore): {
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
} {
  const isBannerVisible = state.isClientMounted && state.consent === null && !state.isPreferencesOpen;
  return {
    consent: state.consent,
    isBannerVisible,
    isPreferencesOpen: state.isPreferencesOpen,
    draft: state.draft,
    setDraftAnalytics: state.setDraftAnalytics,
    openPreferences: state.openPreferences,
    closePreferences: state.closePreferences,
    acceptAll: state.acceptAll,
    acceptEssentialOnly: state.acceptEssentialOnly,
    saveCustomPreferences: state.saveCustomPreferences,
    dismissBanner: state.dismissBanner,
  };
}
