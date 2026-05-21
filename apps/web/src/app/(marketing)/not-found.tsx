import type { ReactElement } from 'react';
import { MarketingNotFound } from '@/components/marketing/marketing-not-found';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Page not found — TechMD',
  description: 'The page you requested could not be found. Return to TechMD home, blog, or start a guided diagnostic.',
});

export default function MarketingNotFoundPage(): ReactElement {
  return <MarketingNotFound />;
}
