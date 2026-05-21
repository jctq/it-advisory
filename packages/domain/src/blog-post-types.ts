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
  createdAt: Date;
  updatedAt: Date;
  /** Set when status first becomes published; retained if unpublished later. */
  publishedAt: Date | null;
};
