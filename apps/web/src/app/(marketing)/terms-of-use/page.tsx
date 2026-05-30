import type { ReactElement } from 'react';
import { MarketingLegalPage } from '@/components/marketing/legal/marketing-legal-page';
import { buildPageMetadata } from '@/lib/seo/site-seo';

export async function generateMetadata() {
  return buildPageMetadata('termsOfUse', { pathname: '/terms-of-use' });
}

export default async function TermsOfUsePage(): Promise<ReactElement> {
  return <MarketingLegalPage documentId="terms-of-use" eyebrow="Legal" />;
}
