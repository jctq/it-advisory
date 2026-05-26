import type { ObjectId } from 'mongodb';

export type BlogPostStatus = 'draft' | 'published';

export type BlogPostDocument = {
  _id?: ObjectId;
  /** Optional display title; listing falls back to slug when empty. */
  title: string | null;
  /** Optional short summary shown under the title on listings, articles, and embeds. */
  description: string | null;
  /** URL-safe unique slug for `/blog/[slug]`. */
  slug: string;
  contentMarkdown: string;
  status: BlogPostStatus;
  /** When published, include this post on the public /blog index. */
  showInBlogList: boolean;
  /** Show the title on article pages, embeds, and list cards (when listed). */
  showTitle: boolean;
  /** Optional override for HTML meta title and social card title. */
  seoTitle: string | null;
  /** Optional override for meta description and social card description. */
  seoDescription: string | null;
  /** Optional absolute or site-relative URL for Open Graph / Twitter image. */
  ogImageUrl: string | null;
  /** Optional comma-separated keywords for meta keywords. */
  seoKeywords: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Set when status first becomes published; retained if unpublished later. */
  publishedAt: Date | null;
};
