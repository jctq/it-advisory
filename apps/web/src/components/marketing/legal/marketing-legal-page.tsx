import type { ReactElement } from 'react';
import Link from 'next/link';
import { MarketingLegalDocument } from '@/components/marketing/legal/marketing-legal-document';
import {
  LEGAL_DOCUMENT_PATHS,
  LEGAL_DOCUMENT_TITLES,
  type LegalDocumentId,
} from '@/lib/marketing/legal-document-id';

type MarketingLegalPageProps = {
  readonly documentId: LegalDocumentId;
  readonly eyebrow: string;
};

/**
 * Full-page layout for standalone privacy policy and terms routes.
 */
export function MarketingLegalPage(props: MarketingLegalPageProps): ReactElement {
  const title = LEGAL_DOCUMENT_TITLES[props.documentId];
  const siblingId: LegalDocumentId =
    props.documentId === 'privacy-policy' ? 'terms-of-use' : 'privacy-policy';
  const siblingTitle = LEGAL_DOCUMENT_TITLES[siblingId];
  const siblingPath = LEGAL_DOCUMENT_PATHS[siblingId];
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{props.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Independent technology guidance for growing teams in the Philippines.
        </p>
        <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
          <MarketingLegalDocument documentId={props.documentId} />
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          See also{' '}
          <Link href={siblingPath} className="font-medium text-primary underline-offset-2 hover:underline">
            {siblingTitle}
          </Link>
          {' · '}
          <Link href="/" className="text-primary underline-offset-2 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
