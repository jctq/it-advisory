export type LegalDocumentId = 'privacy-policy' | 'terms-of-use';

export const LEGAL_DOCUMENT_TITLES: Readonly<Record<LegalDocumentId, string>> = {
  'privacy-policy': 'Privacy Policy',
  'terms-of-use': 'Terms of Use',
} as const;

export const LEGAL_DOCUMENT_PATHS: Readonly<Record<LegalDocumentId, string>> = {
  'privacy-policy': '/privacy-policy',
  'terms-of-use': '/terms-of-use',
} as const;

export const LEGAL_LAST_UPDATED = 'May 21, 2026';
