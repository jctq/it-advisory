import type { ReactElement } from 'react';
import { BlogPostEmbed } from '@/components/marketing/blog/blog-post-embed';
import { DefaultPrivacyPolicyContent } from '@/components/marketing/legal/default-privacy-policy-content';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';
import { getPrivacyPolicyBlogPostIdFromEnv } from '@/lib/marketing/legal-blog-embed-config';

/**
 * Privacy policy body: CMS embed when `PRIVACY_POLICY_BLOG_POST_ID` is set, otherwise built-in copy.
 */
export async function PrivacyPolicyContent(): Promise<ReactElement> {
  const embedPostId = getPrivacyPolicyBlogPostIdFromEnv();
  if (embedPostId === null) {
    return <DefaultPrivacyPolicyContent />;
  }
  const embed = await BlogPostEmbed({ postId: embedPostId, showTitle: false, showPublishedDate: true });
  if (embed === null) {
    return <DefaultPrivacyPolicyContent />;
  }
  return <MarketingLegalProse>{embed}</MarketingLegalProse>;
}
