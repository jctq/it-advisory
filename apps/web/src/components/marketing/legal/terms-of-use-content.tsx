import type { ReactElement } from 'react';
import { BlogPostEmbed } from '@/components/marketing/blog/blog-post-embed';
import { MarketingLegalEmptyContent } from '@/components/marketing/legal/marketing-legal-empty-content';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';
import { resolveLegalDocumentBlogPostId } from '@/lib/marketing/resolve-legal-document-blog-post-id';

/**
 * Terms of use body: CMS embed when configured in env or by published slug, otherwise empty state.
 */
export async function TermsOfUseContent(): Promise<ReactElement> {
  const embedPostId = await resolveLegalDocumentBlogPostId('terms-of-use');
  if (embedPostId === null) {
    return <MarketingLegalEmptyContent />;
  }
  const embed = await BlogPostEmbed({ postId: embedPostId, showTitle: false, showPublishedDate: true });
  if (embed === null) {
    return <MarketingLegalEmptyContent />;
  }
  return <MarketingLegalProse>{embed}</MarketingLegalProse>;
}
