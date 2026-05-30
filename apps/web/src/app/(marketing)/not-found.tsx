import type { ReactElement } from 'react';
import { MarketingNotFound } from '@/components/marketing/marketing-not-found';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Page not found — TeqMD',
  description: 'The page you requested could not be found. Return to TeqMD home, blog, or start a guided diagnostic.',
});

export default function MarketingNotFoundPage(): ReactElement {
  return <MarketingNotFound />;
}
