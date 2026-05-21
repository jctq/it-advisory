'use client';

import { useMarketingCookieConsent } from '@/components/marketing/cookie-consent/marketing-cookie-consent-context';
import type { ReactElement } from 'react';

type MarketingCookiePreferencesLinkProps = {
  readonly className?: string;
};

/**
 * Footer control to reopen cookie preferences after the initial choice.
 */
export function MarketingCookiePreferencesLink(props: MarketingCookiePreferencesLinkProps): ReactElement {
  const { openPreferences } = useMarketingCookieConsent();
  return (
    <button
      type="button"
      className={props.className}
      onClick={openPreferences}
    >
      Cookie preferences
    </button>
  );
}
