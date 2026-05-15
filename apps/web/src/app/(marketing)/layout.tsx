import type { ReactNode } from 'react';
import { MarketingSmoothScroll } from '@/components/marketing/marketing-smooth-scroll';
import { MarketingAppearanceProvider } from '@/components/marketing/marketing-appearance-provider';
import { SiteHeader } from '@/components/marketing/site-header';

export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <MarketingAppearanceProvider>
      <div className="flex min-h-dvh flex-col">
        <MarketingSmoothScroll />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border bg-muted/20 py-10 text-center transition-colors">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-sm font-medium text-foreground">TechMD</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs text-muted-foreground">
              Pain-first guidance · Guided steps · Minimal typing · Personalized recommendation · Fast to value
            </p>
          </div>
        </footer>
      </div>
    </MarketingAppearanceProvider>
  );
}
