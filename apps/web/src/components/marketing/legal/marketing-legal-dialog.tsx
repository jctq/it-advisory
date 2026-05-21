'use client';

import type { ReactElement, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LEGAL_DOCUMENT_TITLES, type LegalDocumentId } from '@/lib/marketing/legal-document-id';

type MarketingLegalDialogProps = {
  readonly documentId: LegalDocumentId | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly privacyPolicyContent: ReactNode;
  readonly termsOfUseContent: ReactNode;
};

/**
 * Scrollable dialog that displays privacy policy or terms of use without leaving the page.
 */
export function MarketingLegalDialog(props: MarketingLegalDialogProps): ReactElement {
  const title = props.documentId !== null ? LEGAL_DOCUMENT_TITLES[props.documentId] : '';
  const bodyContent =
    props.documentId === 'privacy-policy'
      ? props.privacyPolicyContent
      : props.documentId === 'terms-of-use'
        ? props.termsOfUseContent
        : null;
  return (
    <Dialog open={props.documentId !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {props.documentId !== null ? `${title} for TechMD` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{bodyContent}</div>
      </DialogContent>
    </Dialog>
  );
}
