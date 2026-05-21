import type { BlogPostStatus } from '@/domain/blog-post-types';

export type BlogPostValue = {
  readonly id: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly slug: string;
  readonly contentMarkdown: string;
  readonly status: BlogPostStatus;
  readonly showInBlogList: boolean;
  readonly showTitle: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly publishedAtIso: string | null;
};

export type BlogPostListFilter = {
  readonly status?: BlogPostStatus;
};

export type CreateBlogPostInput = {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly slug?: string;
  readonly contentMarkdown?: string;
  readonly status?: BlogPostStatus;
  readonly showInBlogList?: boolean;
  readonly showTitle?: boolean;
};

export type UpdateBlogPostInput = {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly slug?: string;
  readonly contentMarkdown?: string;
  readonly status?: BlogPostStatus;
  readonly showInBlogList?: boolean;
  readonly showTitle?: boolean;
};

const DEFAULT_DRAFT_SLUG_PREFIX = 'untitled';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyBlogPostTitle(title: string | null | undefined): string {
  const normalizedValue = (title?.trim() ?? DEFAULT_DRAFT_SLUG_PREFIX)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalizedValue.length > 0 ? normalizedValue : DEFAULT_DRAFT_SLUG_PREFIX;
}

export function isValidBlogPostSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function getBlogPostDisplayTitle(post: BlogPostValue): string {
  return post.title ?? post.slug;
}

/** Description when set; otherwise an excerpt from markdown body. */
export function getBlogPostSummary(post: BlogPostValue, maxExcerptLength = 160): string {
  const trimmedDescription = post.description?.trim() ?? '';
  if (trimmedDescription.length > 0) {
    return trimmedDescription;
  }
  return buildBlogPostExcerpt(post.contentMarkdown, maxExcerptLength);
}

export function buildBlogPostExcerpt(contentMarkdown: string, maxLength = 160): string {
  const plainText = contentMarkdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plainText.length <= maxLength) {
    return plainText;
  }
  return `${plainText.slice(0, maxLength - 1).trimEnd()}…`;
}
