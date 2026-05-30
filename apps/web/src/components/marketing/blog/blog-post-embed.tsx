import { format } from 'date-fns';
import type { ReactElement } from 'react';
import { MarketingBlogProse } from '@/components/marketing/blog/marketing-blog-prose';
import { getBlogPostDisplayTitle } from '@/lib/blog-post-types';
import { findBlogPostById } from '@/lib/data/blog-posts';

type BlogPostEmbedProps = {
  readonly postId: string;
  readonly showTitle?: boolean;
  readonly showPublishedDate?: boolean;
};

/**
 * Embeds a published blog post by MongoDB id (not exposed in page URLs).
 */
export async function BlogPostEmbed(props: BlogPostEmbedProps): Promise<ReactElement | null> {
  const post = await findBlogPostById(props.postId);
  if (post === null || post.status !== 'published') {
    return null;
  }
  const showTitle = post.showTitle && props.showTitle !== false;
  const showPublishedDate = props.showPublishedDate === true;
  const descriptionText = post.description?.trim() ?? '';
  return (
    <article className="space-y-4">
      {showTitle ? (
        <h2 className="text-base font-semibold tracking-tight text-foreground">{getBlogPostDisplayTitle(post)}</h2>
      ) : null}
      {descriptionText.length > 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{descriptionText}</p>
      ) : null}
      {showPublishedDate ? (
        <p className="text-xs text-muted-foreground/90">
          Last updated: {format(new Date(post.updatedAtIso), 'MMMM d, yyyy')}
        </p>
      ) : null}
      <MarketingBlogProse contentMarkdown={post.contentMarkdown} />
    </article>
  );
}
