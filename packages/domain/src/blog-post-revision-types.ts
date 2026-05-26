import type { ObjectId } from 'mongodb';
import type { BlogPostStatus } from './blog-post-types';

/** Snapshot of editable blog post fields at a point in time (for revision diffs). */
export type BlogPostRevisionSnapshot = {
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
};

/** Append-only row written when a blog post is saved with changes. */
export type BlogPostRevisionDocument = {
  _id?: ObjectId;
  readonly postId: ObjectId;
  readonly savedAt: Date;
  readonly before: BlogPostRevisionSnapshot;
  readonly after: BlogPostRevisionSnapshot;
};
