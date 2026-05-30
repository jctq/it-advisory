import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { MarketingNotFound } from '@/components/marketing/marketing-not-found';
import { MarketingRouteScroll } from '@/components/marketing/marketing-route-scroll';
import { MarketingSmoothScroll } from '@/components/marketing/marketing-smooth-scroll';
import { MarketingAppearanceProvider } from '@/components/marketing/marketing-appearance-provider';
import { MarketingSiteFooter } from '@/components/marketing/marketing-site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export const metadata: Metadata = {
  title: 'Page not found — TeqMD',
  description: 'The page you requested could not be found. Return to TeqMD home, blog, or start a guided diagnostic.',
};

/**
 * Global 404 for URLs outside route groups (e.g. mistyped paths). Marketing segment uses `(marketing)/not-found.tsx`.
 */
export default function RootNotFoundPage(): ReactElement {
  return (
    <MarketingAppearanceProvider>
      <div className="flex min-h-dvh flex-col">
        <MarketingSmoothScroll />
        <MarketingRouteScroll />
        <SiteHeader />
        <MarketingNotFound />
        <MarketingSiteFooter />
      </div>
    </MarketingAppearanceProvider>
  );
}
