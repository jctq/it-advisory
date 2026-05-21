import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BlogPostDocument, BlogPostStatus } from '@/domain/blog-post-types';
import {
  buildBlogPostExcerpt,
  getBlogPostDisplayTitle,
  isValidBlogPostSlug,
  slugifyBlogPostTitle,
  type BlogPostListFilter,
  type BlogPostValue,
  type CreateBlogPostInput,
  type UpdateBlogPostInput,
} from '@/lib/blog-post-types';
import { buildBlogPostRevisionSnapshot } from '@/lib/blog-post-revision-types';
import { recordBlogPostRevision, deleteBlogPostRevisionsForPost } from '@/lib/data/blog-post-revisions';
import { getDb } from '@/lib/mongodb';

export type {
  BlogPostListFilter,
  BlogPostValue,
  CreateBlogPostInput,
  UpdateBlogPostInput,
} from '@/lib/blog-post-types';

export {
  buildBlogPostExcerpt,
  getBlogPostDisplayTitle,
  isValidBlogPostSlug,
  slugifyBlogPostTitle,
};

type BlogPostStoredDocument = BlogPostDocument & {
  readonly _id: ObjectId;
};

function normalizeOptionalTitle(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeOptionalDescription(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeSlugBase(value: string): string {
  return slugifyBlogPostTitle(value);
}

function mapBlogPost(doc: BlogPostStoredDocument): BlogPostValue {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description ?? null,
    slug: doc.slug,
    contentMarkdown: doc.contentMarkdown,
    status: doc.status,
    showInBlogList: doc.showInBlogList !== false,
    showTitle: doc.showTitle !== false,
    createdAtIso: doc.createdAt.toISOString(),
    updatedAtIso: doc.updatedAt.toISOString(),
    publishedAtIso: doc.publishedAt === null ? null : doc.publishedAt.toISOString(),
  };
}

async function getCollection(): Promise<Collection<BlogPostDocument>> {
  const db = await getDb();
  return db.collection<BlogPostDocument>(COLLECTIONS.blogPosts);
}

async function resolveUniqueSlug(baseSlug: string, excludePostId?: string): Promise<string> {
  const collection = await getCollection();
  let candidateSlug = baseSlug;
  let suffix = 2;
  while (true) {
    const existing = await collection.findOne({ slug: candidateSlug });
    if (existing === null || existing._id === undefined) {
      return candidateSlug;
    }
    if (excludePostId !== undefined && existing._id.toString() === excludePostId) {
      return candidateSlug;
    }
    candidateSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function listBlogPosts(filter?: BlogPostListFilter): Promise<BlogPostValue[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  try {
    const collection = await getCollection();
    const query = filter?.status === undefined ? {} : { status: filter.status };
    const docs = await collection
      .find(query)
      .sort(
        filter?.status === 'published'
          ? { publishedAt: -1, updatedAt: -1 }
          : { updatedAt: -1 },
      )
      .toArray();
    return docs.map((doc) => mapBlogPost(doc as BlogPostStoredDocument));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load blog posts: ${message}`);
  }
}

const PUBLISHED_BLOG_LIST_FILTER = {
  status: 'published' as const,
  showInBlogList: { $ne: false as const },
};

export async function listPublishedBlogPosts(): Promise<BlogPostValue[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  try {
    const collection = await getCollection();
    const docs = await collection
      .find(PUBLISHED_BLOG_LIST_FILTER)
      .sort({ publishedAt: -1, updatedAt: -1 })
      .toArray();
    return docs.map((doc) => mapBlogPost(doc as BlogPostStoredDocument));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load blog posts: ${message}`);
  }
}

export type ListPublishedBlogPostsPageInput = {
  readonly page: number;
  readonly pageSize: number;
};

export type PublishedBlogPostsPageResult = {
  readonly posts: readonly BlogPostValue[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

export async function listPublishedBlogPostsPage(
  input: ListPublishedBlogPostsPageInput,
): Promise<PublishedBlogPostsPageResult> {
  const page = Math.max(1, Math.floor(input.page));
  const pageSize = Math.max(1, Math.floor(input.pageSize));
  if (!process.env.MONGODB_URI) {
    return { posts: [], page, pageSize, totalCount: 0, totalPages: 0 };
  }
  try {
    const collection = await getCollection();
    const totalCount = await collection.countDocuments(PUBLISHED_BLOG_LIST_FILTER);
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
    const docs = await collection
      .find(PUBLISHED_BLOG_LIST_FILTER)
      .sort({ publishedAt: -1, updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return {
      posts: docs.map((doc) => mapBlogPost(doc as BlogPostStoredDocument)),
      page,
      pageSize,
      totalCount,
      totalPages,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load blog posts: ${message}`);
  }
}

export async function findBlogPostById(postId: string): Promise<BlogPostValue | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(postId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(postId) });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return mapBlogPost(doc as BlogPostStoredDocument);
}

export async function findPublishedBlogPostBySlug(slug: string): Promise<BlogPostValue | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne({ slug, status: 'published' });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return mapBlogPost(doc as BlogPostStoredDocument);
}

export async function createBlogPost(input: CreateBlogPostInput = {}): Promise<BlogPostValue> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to manage blog posts.');
  }
  const collection = await getCollection();
  const now = new Date();
  const title = normalizeOptionalTitle(input.title);
  const requestedSlug = input.slug?.trim();
  const baseSlug =
    requestedSlug !== undefined && requestedSlug.length > 0
      ? normalizeSlugBase(requestedSlug)
      : slugifyBlogPostTitle(title);
  if (!isValidBlogPostSlug(baseSlug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens.');
  }
  const slug = await resolveUniqueSlug(baseSlug);
  const status: BlogPostStatus = input.status ?? 'draft';
  const doc: BlogPostDocument = {
    title,
    description: normalizeOptionalDescription(input.description),
    slug,
    contentMarkdown: input.contentMarkdown ?? '',
    status,
    showInBlogList: input.showInBlogList ?? true,
    showTitle: input.showTitle ?? true,
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? now : null,
  };
  const result = await collection.insertOne(doc);
  return mapBlogPost({ ...doc, _id: result.insertedId });
}

export async function updateBlogPost(postId: string, input: UpdateBlogPostInput): Promise<BlogPostValue> {
  if (!ObjectId.isValid(postId)) {
    throw new Error('Invalid blog post id.');
  }
  const collection = await getCollection();
  const current = await collection.findOne({ _id: new ObjectId(postId) });
  if (current === null || current._id === undefined) {
    throw new Error('Blog post not found.');
  }
  const now = new Date();
  let nextSlug = current.slug;
  if (input.slug !== undefined) {
    const normalizedSlug = normalizeSlugBase(input.slug);
    if (!isValidBlogPostSlug(normalizedSlug)) {
      throw new Error('Slug must contain only lowercase letters, numbers, and hyphens.');
    }
    nextSlug = await resolveUniqueSlug(normalizedSlug, postId);
  }
  const nextTitle = input.title === undefined ? current.title : normalizeOptionalTitle(input.title);
  const nextDescription =
    input.description === undefined ? (current.description ?? null) : normalizeOptionalDescription(input.description);
  const nextContentMarkdown = input.contentMarkdown ?? current.contentMarkdown;
  const nextStatus: BlogPostStatus = input.status ?? current.status;
  const nextShowInBlogList = input.showInBlogList ?? current.showInBlogList !== false;
  const nextShowTitle = input.showTitle ?? current.showTitle !== false;
  let nextPublishedAt = current.publishedAt;
  if (nextStatus === 'published' && nextPublishedAt === null) {
    nextPublishedAt = now;
  }
  const beforeSnapshot = buildBlogPostRevisionSnapshot(mapBlogPost(current as BlogPostStoredDocument));
  const nextDoc: BlogPostStoredDocument = {
    _id: current._id,
    title: nextTitle,
    description: nextDescription,
    slug: nextSlug,
    contentMarkdown: nextContentMarkdown,
    status: nextStatus,
    showInBlogList: nextShowInBlogList,
    showTitle: nextShowTitle,
    createdAt: current.createdAt,
    updatedAt: now,
    publishedAt: nextPublishedAt,
  };
  const afterSnapshot = buildBlogPostRevisionSnapshot({
    id: postId,
    title: nextTitle,
    description: nextDescription,
    slug: nextSlug,
    contentMarkdown: nextContentMarkdown,
    status: nextStatus,
    showInBlogList: nextShowInBlogList,
    showTitle: nextShowTitle,
    createdAtIso: current.createdAt.toISOString(),
    updatedAtIso: now.toISOString(),
    publishedAtIso: nextPublishedAt === null ? null : nextPublishedAt.toISOString(),
  });
  await collection.replaceOne({ _id: current._id }, nextDoc);
  await recordBlogPostRevision({ postId, before: beforeSnapshot, after: afterSnapshot });
  return mapBlogPost(nextDoc);
}

export async function deleteBlogPost(postId: string): Promise<void> {
  if (!ObjectId.isValid(postId)) {
    throw new Error('Invalid blog post id.');
  }
  const collection = await getCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(postId) });
  if (result.deletedCount === 0) {
    throw new Error('Blog post not found.');
  }
  await deleteBlogPostRevisionsForPost(postId);
}
