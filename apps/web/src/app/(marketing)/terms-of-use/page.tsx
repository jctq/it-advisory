import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { MarketingLegalPage } from '@/components/marketing/legal/marketing-legal-page';

export const metadata: Metadata = {
  title: 'Terms of Use · TechMD',
  description: 'Terms governing use of the TechMD website and services.',
};

export default function TermsOfUsePage(): ReactElement {
  return <MarketingLegalPage documentId="terms-of-use" eyebrow="Legal" />;
}
