import type { ReactElement } from 'react';
import { BlogPostEmbed } from '@/components/marketing/blog/blog-post-embed';
import { DefaultPrivacyPolicyContent } from '@/components/marketing/legal/default-privacy-policy-content';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';
import { resolveLegalDocumentBlogPostId } from '@/lib/marketing/resolve-legal-document-blog-post-id';

/**
 * Privacy policy body: CMS embed when configured in env or by published slug, otherwise built-in copy.
 */
export async function PrivacyPolicyContent(): Promise<ReactElement> {
  const embedPostId = await resolveLegalDocumentBlogPostId('privacy-policy');
  if (embedPostId === null) {
    return <DefaultPrivacyPolicyContent />;
  }
  const embed = await BlogPostEmbed({ postId: embedPostId, showTitle: false, showPublishedDate: true });
  if (embed === null) {
    return <DefaultPrivacyPolicyContent />;
  }
  return <MarketingLegalProse>{embed}</MarketingLegalProse>;
}
