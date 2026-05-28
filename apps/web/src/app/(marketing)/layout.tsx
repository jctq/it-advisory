import type { ReactNode } from 'react';
import { MarketingCookieConsent } from '@/components/marketing/cookie-consent/marketing-cookie-consent';
import { MarketingRouteScroll } from '@/components/marketing/marketing-route-scroll';
import { MarketingSmoothScroll } from '@/components/marketing/marketing-smooth-scroll';
import { MarketingAppearanceProvider } from '@/components/marketing/marketing-appearance-provider';
import { MarketingSiteFooter } from '@/components/marketing/marketing-site-footer';
import { MarketingSupportReport } from '@/components/marketing/support-report/marketing-support-report';
import { SiteHeader } from '@/components/marketing/site-header';
import { readSupportModuleEnabled } from '@/lib/marketing/support-module-gate';

export default async function MarketingLayout({ children }: { readonly children: ReactNode }) {
  const supportModuleEnabled = await readSupportModuleEnabled();
  const content = (
    <>
      <MarketingSmoothScroll />
      <MarketingRouteScroll />
      <SiteHeader supportModuleEnabled={supportModuleEnabled} />
      <div id="marketing-main-content" className="flex-1">
        {children}
      </div>
      <MarketingSiteFooter />
    </>
  );
  return (
    <MarketingAppearanceProvider>
      <MarketingCookieConsent>
        {supportModuleEnabled ? <MarketingSupportReport>{content}</MarketingSupportReport> : content}
      </MarketingCookieConsent>
    </MarketingAppearanceProvider>
  );
}
