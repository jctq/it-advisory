import type { BlogPostRevisionSnapshot } from '@/domain/blog-post-revision-types';
import type { BlogPostValue } from '@/lib/blog-post-types';

export type { BlogPostRevisionSnapshot };

export type BlogPostRevisionFieldKey = keyof BlogPostRevisionSnapshot;

export const BLOG_POST_REVISION_FIELD_LABELS: Record<BlogPostRevisionFieldKey, string> = {
  title: 'Title',
  description: 'Description',
  slug: 'Slug',
  contentMarkdown: 'Content',
  status: 'Status',
  showInBlogList: 'Show on blog index',
  showTitle: 'Show title',
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  ogImageUrl: 'Social image URL',
  seoKeywords: 'SEO keywords',
};

export type BlogPostRevisionListItem = {
  readonly id: string;
  readonly savedAtIso: string;
  readonly changedFields: readonly BlogPostRevisionFieldKey[];
  readonly summary: string;
};

export type TextDiffLine = {
  readonly type: 'added' | 'removed' | 'unchanged';
  readonly content: string;
  readonly oldLineNumber: number | null;
  readonly newLineNumber: number | null;
};

export type BlogPostRevisionFieldDiff = {
  readonly field: BlogPostRevisionFieldKey;
  readonly label: string;
  readonly beforeDisplay: string;
  readonly afterDisplay: string;
  readonly lines: readonly TextDiffLine[];
};

export type BlogPostRevisionDetail = {
  readonly id: string;
  readonly savedAtIso: string;
  readonly changedFields: readonly BlogPostRevisionFieldKey[];
  readonly fieldDiffs: readonly BlogPostRevisionFieldDiff[];
};

export function buildBlogPostRevisionSnapshot(post: BlogPostValue): BlogPostRevisionSnapshot {
  return {
    title: post.title,
    description: post.description,
    slug: post.slug,
    contentMarkdown: post.contentMarkdown,
    status: post.status,
    showInBlogList: post.showInBlogList,
    showTitle: post.showTitle,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    ogImageUrl: post.ogImageUrl,
    seoKeywords: post.seoKeywords,
  };
}

const BLOG_POST_REVISION_FIELD_KEYS: readonly BlogPostRevisionFieldKey[] = [
  'title',
  'description',
  'slug',
  'contentMarkdown',
  'status',
  'showInBlogList',
  'showTitle',
  'seoTitle',
  'seoDescription',
  'ogImageUrl',
  'seoKeywords',
];

export function listChangedBlogPostRevisionFields(
  before: BlogPostRevisionSnapshot,
  after: BlogPostRevisionSnapshot,
): BlogPostRevisionFieldKey[] {
  return BLOG_POST_REVISION_FIELD_KEYS.filter((field) => before[field] !== after[field]);
}

export function buildBlogPostRevisionSummary(changedFields: readonly BlogPostRevisionFieldKey[]): string {
  if (changedFields.length === 0) {
    return 'No changes';
  }
  const labels = changedFields.map((field) => BLOG_POST_REVISION_FIELD_LABELS[field]);
  if (labels.length <= 2) {
    return labels.join(' and ');
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function formatBlogPostRevisionFieldValue(
  field: BlogPostRevisionFieldKey,
  value: BlogPostRevisionSnapshot[BlogPostRevisionFieldKey],
): string {
  if (field === 'showInBlogList' || field === 'showTitle') {
    return value ? 'Yes' : 'No';
  }
  if (
    field === 'title' ||
    field === 'description' ||
    field === 'seoTitle' ||
    field === 'seoDescription' ||
    field === 'ogImageUrl' ||
    field === 'seoKeywords'
  ) {
    const textValue = value as string | null;
    return textValue === null || textValue.trim().length === 0 ? '(empty)' : textValue;
  }
  return String(value);
}
