import type { ReactElement } from 'react';
import { MarketingLegalPage } from '@/components/marketing/legal/marketing-legal-page';
import { buildMarketingMetadata } from '@/lib/seo/site-seo';

export const metadata = buildMarketingMetadata({
  title: 'Terms of Use · TeqMD',
  description: 'Terms governing use of the TeqMD website and services.',
  pathname: '/terms-of-use',
});

export default async function TermsOfUsePage(): Promise<ReactElement> {
  return <MarketingLegalPage documentId="terms-of-use" eyebrow="Legal" />;
}
