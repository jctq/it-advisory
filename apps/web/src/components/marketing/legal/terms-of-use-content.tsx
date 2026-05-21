import type { ReactElement } from 'react';
import { BlogPostEmbed } from '@/components/marketing/blog/blog-post-embed';
import { DefaultTermsOfUseContent } from '@/components/marketing/legal/default-terms-of-use-content';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';
import { getTermsOfUseBlogPostIdFromEnv } from '@/lib/marketing/legal-blog-embed-config';

/**
 * Terms of use body: CMS embed when `TERMS_OF_USE_BLOG_POST_ID` is set, otherwise built-in copy.
 */
export async function TermsOfUseContent(): Promise<ReactElement> {
  const embedPostId = getTermsOfUseBlogPostIdFromEnv();
  if (embedPostId === null) {
    return <DefaultTermsOfUseContent />;
  }
  const embed = await BlogPostEmbed({ postId: embedPostId, showTitle: false, showPublishedDate: true });
  if (embed === null) {
    return <DefaultTermsOfUseContent />;
  }
  return <MarketingLegalProse>{embed}</MarketingLegalProse>;
}
