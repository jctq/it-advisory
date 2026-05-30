import { ObjectId } from 'mongodb';
import type { LegalDocumentId } from '@/lib/marketing/legal-document-id';

function normalizeBlogPostIdFromEnv(envValue: string | undefined): string | null {
  const trimmedValue = envValue?.trim() ?? '';
  if (trimmedValue.length === 0) {
    return null;
  }
  if (!ObjectId.isValid(trimmedValue)) {
    return null;
  }
  return trimmedValue;
}

/** MongoDB blog post id for CMS-driven privacy policy; unset shows empty state. */
export function getPrivacyPolicyBlogPostIdFromEnv(): string | null {
  return normalizeBlogPostIdFromEnv(process.env.PRIVACY_POLICY_BLOG_POST_ID);
}

/** MongoDB blog post id for CMS-driven terms of use; unset shows empty state. */
export function getTermsOfUseBlogPostIdFromEnv(): string | null {
  return normalizeBlogPostIdFromEnv(process.env.TERMS_OF_USE_BLOG_POST_ID);
}

export function getLegalDocumentBlogPostIdFromEnv(documentId: LegalDocumentId): string | null {
  if (documentId === 'privacy-policy') {
    return getPrivacyPolicyBlogPostIdFromEnv();
  }
  return getTermsOfUseBlogPostIdFromEnv();
}
