'use client';

import { MarketingCookieConsentBanner } from '@/components/marketing/cookie-consent/marketing-cookie-consent-banner';
import { MarketingCookieConsentProvider } from '@/components/marketing/cookie-consent/marketing-cookie-consent-context';
import { MarketingCookiePreferencesDialog } from '@/components/marketing/cookie-consent/marketing-cookie-preferences-dialog';
import type { ReactElement, ReactNode } from 'react';

type MarketingCookieConsentProps = {
  readonly children: ReactNode;
};

/**
 * Marketing-site cookie consent shell: provider, banner, and preferences dialog.
 */
export function MarketingCookieConsent(props: MarketingCookieConsentProps): ReactElement {
  return (
    <MarketingCookieConsentProvider>
      {props.children}
      <MarketingCookieConsentBanner />
      <MarketingCookiePreferencesDialog />
    </MarketingCookieConsentProvider>
  );
}
