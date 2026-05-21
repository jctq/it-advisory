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
export function MarketingLegalDocument(props: MarketingLegalDocumentProps): ReactElement {
  if (props.documentId === 'privacy-policy') {
    return <PrivacyPolicyContent />;
  }
  return <TermsOfUseContent />;
}
