import type { BlogPostValue } from '@/lib/blog-post-types';

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

/**
 * Returns the first image URL from markdown body content, if any.
 */
export function extractBlogPostCoverImageUrl(contentMarkdown: string): string | null {
  const match = MARKDOWN_IMAGE_PATTERN.exec(contentMarkdown);
  if (match === null) {
    return null;
  }
  const url = match[1]?.trim() ?? '';
  return url.length > 0 ? url : null;
}

/** Explicit OG image on the post, else the first markdown image. */
export function resolveBlogPostOpenGraphImageUrl(post: BlogPostValue): string | null {
  const explicitUrl = post.ogImageUrl?.trim() ?? '';
  if (explicitUrl.length > 0) {
    return explicitUrl;
  }
  return extractBlogPostCoverImageUrl(post.contentMarkdown);
}
