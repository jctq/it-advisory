import type { ReactElement } from 'react';
import { PrivacyPolicyContent } from '@/components/marketing/legal/privacy-policy-content';
import { TermsOfUseContent } from '@/components/marketing/legal/terms-of-use-content';
import type { LegalDocumentId } from '@/lib/marketing/legal-document-id';

type MarketingLegalDocumentProps = {
  readonly documentId: LegalDocumentId;
};

/**
 * Renders the body of a legal document by identifier.
 */
export async function MarketingLegalDocument(props: MarketingLegalDocumentProps): Promise<ReactElement> {
  if (props.documentId === 'privacy-policy') {
    return <PrivacyPolicyContent />;
  }
  return <TermsOfUseContent />;
}
