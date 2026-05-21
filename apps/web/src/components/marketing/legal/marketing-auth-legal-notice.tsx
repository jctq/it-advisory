'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactElement } from 'react';
import { MarketingLegalDialog } from '@/components/marketing/legal/marketing-legal-dialog';
import type { LegalDocumentId } from '@/lib/marketing/legal-document-id';

type MarketingAuthLegalNoticeProps = {
  readonly variant: 'login' | 'register';
};

function LegalDocumentButton(props: {
  readonly documentId: LegalDocumentId;
  readonly label: string;
  readonly onOpen: (documentId: LegalDocumentId) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="font-medium text-primary underline-offset-2 hover:underline"
      onClick={() => props.onOpen(props.documentId)}
    >
      {props.label}
    </button>
  );
}

/**
 * Footer notice on login and registration with in-page legal document dialogs.
 */
export function MarketingAuthLegalNotice(props: MarketingAuthLegalNoticeProps): ReactElement {
  const [openDocumentId, setOpenDocumentId] = useState<LegalDocumentId | null>(null);
  const openLegalDocument = useCallback((documentId: LegalDocumentId): void => {
    setOpenDocumentId(documentId);
  }, []);
  const handleDialogOpenChange = useCallback((open: boolean): void => {
    if (!open) {
      setOpenDocumentId(null);
    }
  }, []);
  const securityNote =
    props.variant === 'register'
      ? 'We store a salted password hash only — never the plaintext password. '
      : 'Use a secure password you do not reuse elsewhere. ';
  return (
    <>
      <p className="mx-auto max-w-lg text-center text-xs text-muted-foreground">
        {securityNote}
        By continuing, you agree to our{' '}
        <LegalDocumentButton documentId="terms-of-use" label="Terms of Use" onOpen={openLegalDocument} /> and{' '}
        <LegalDocumentButton documentId="privacy-policy" label="Privacy Policy" onOpen={openLegalDocument} />.
      </p>
      <MarketingLegalDialog documentId={openDocumentId} onOpenChange={handleDialogOpenChange} />
    </>
  );
}
