import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { MarketingLegalPage } from '@/components/marketing/legal/marketing-legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy · TechMD',
  description: 'How TechMD collects, uses, and protects your information.',
};

export default function PrivacyPolicyPage(): ReactElement {
  return <MarketingLegalPage documentId="privacy-policy" eyebrow="Legal" />;
}
