import { findPublishedBlogPostBySlug } from '@/lib/data/blog-posts';
import { getLegalDocumentBlogPostIdFromEnv } from '@/lib/marketing/legal-blog-embed-config';
import type { LegalDocumentId } from '@/lib/marketing/legal-document-id';

/**
 * Resolves the MongoDB blog post id for a legal document: env override first, then published slug match.
 */
export async function resolveLegalDocumentBlogPostId(documentId: LegalDocumentId): Promise<string | null> {
  const embedPostIdFromEnv = getLegalDocumentBlogPostIdFromEnv(documentId);
  if (embedPostIdFromEnv !== null) {
    return embedPostIdFromEnv;
  }
  const post = await findPublishedBlogPostBySlug(documentId);
  return post?.id ?? null;
}
