import type { ReactNode } from 'react';
import { MarketingCookieConsent } from '@/components/marketing/cookie-consent/marketing-cookie-consent';
import { MarketingRouteScroll } from '@/components/marketing/marketing-route-scroll';
import { MarketingSmoothScroll } from '@/components/marketing/marketing-smooth-scroll';
import { MarketingAppearanceProvider } from '@/components/marketing/marketing-appearance-provider';
import { MarketingSiteFooter } from '@/components/marketing/marketing-site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <MarketingAppearanceProvider>
      <MarketingCookieConsent>
        <div className="flex min-h-dvh flex-col">
          <MarketingSmoothScroll />
          <MarketingRouteScroll />
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <MarketingSiteFooter />
        </div>
      </MarketingCookieConsent>
    </MarketingAppearanceProvider>
  );
}
