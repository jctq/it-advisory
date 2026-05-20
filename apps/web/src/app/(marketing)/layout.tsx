import type { ReactNode } from 'react';
import { MarketingSmoothScroll } from '@/components/marketing/marketing-smooth-scroll';
import { MarketingAppearanceProvider } from '@/components/marketing/marketing-appearance-provider';
import { MarketingSiteFooter } from '@/components/marketing/marketing-site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <MarketingAppearanceProvider>
      <div className="flex min-h-dvh flex-col">
        <MarketingSmoothScroll />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <MarketingSiteFooter />
      </div>
    </MarketingAppearanceProvider>
  );
}
