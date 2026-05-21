import type { ReactElement } from 'react';
import { MarketingLegalPage } from '@/components/marketing/legal/marketing-legal-page';
import { buildMarketingMetadata } from '@/lib/seo/site-seo';

export const metadata = buildMarketingMetadata({
  title: 'Privacy Policy · TechMD',
  description: 'How TechMD collects, uses, and protects your information.',
  pathname: '/privacy-policy',
});

export default async function PrivacyPolicyPage(): Promise<ReactElement> {
  return <MarketingLegalPage documentId="privacy-policy" eyebrow="Legal" />;
}
