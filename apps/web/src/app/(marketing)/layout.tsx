import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/marketing/site-header';

export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-2xl px-6">
          Pain-first guidance · Guided steps · Minimal typing · Personalized recommendation · Fast to value
        </p>
      </footer>
    </div>
  );
}
