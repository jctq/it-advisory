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
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly ogImageUrl: string | null;
  readonly seoKeywords: string | null;
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
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
  readonly ogImageUrl?: string | null;
  readonly seoKeywords?: string | null;
};

export type UpdateBlogPostInput = {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly slug?: string;
  readonly contentMarkdown?: string;
  readonly status?: BlogPostStatus;
  readonly showInBlogList?: boolean;
  readonly showTitle?: boolean;
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
  readonly ogImageUrl?: string | null;
  readonly seoKeywords?: string | null;
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

/** Meta / social title: SEO override, then display title. */
export function getBlogPostSeoTitle(post: BlogPostValue): string {
  const trimmedSeoTitle = post.seoTitle?.trim() ?? '';
  if (trimmedSeoTitle.length > 0) {
    return trimmedSeoTitle;
  }
  return getBlogPostDisplayTitle(post);
}

/** Meta / social description: SEO override, then article summary. */
export function getBlogPostSeoDescription(post: BlogPostValue, maxExcerptLength = 160): string {
  const trimmedSeoDescription = post.seoDescription?.trim() ?? '';
  if (trimmedSeoDescription.length > 0) {
    return trimmedSeoDescription;
  }
  return getBlogPostSummary(post, maxExcerptLength);
}

/** Parses comma-separated SEO keywords into a trimmed, non-empty list. */
export function parseBlogPostSeoKeywords(post: BlogPostValue): readonly string[] {
  const rawKeywords = post.seoKeywords?.trim() ?? '';
  if (rawKeywords.length === 0) {
    return [];
  }
  return rawKeywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
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
