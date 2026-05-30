import type { ReactElement } from 'react';
import { MarketingLegalPage } from '@/components/marketing/legal/marketing-legal-page';
import { buildPageMetadata } from '@/lib/seo/site-seo';

export async function generateMetadata() {
  return buildPageMetadata('privacyPolicy', { pathname: '/privacy-policy' });
}

export default async function PrivacyPolicyPage(): Promise<ReactElement> {
  return <MarketingLegalPage documentId="privacy-policy" eyebrow="Legal" />;
}
