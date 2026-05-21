import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BlogPostRevisionDocument, BlogPostRevisionSnapshot } from '@/domain/blog-post-revision-types';
import {
  buildBlogPostRevisionSummary,
  listChangedBlogPostRevisionFields,
  type BlogPostRevisionDetail,
  type BlogPostRevisionListItem,
} from '@/lib/blog-post-revision-types';
import { buildBlogPostRevisionDetail } from '@/lib/blog-post-revision-diff';
import { getDb } from '@/lib/mongodb';

type BlogPostRevisionStoredDocument = BlogPostRevisionDocument & {
  readonly _id: ObjectId;
};

function mapRevisionListItem(doc: BlogPostRevisionStoredDocument): BlogPostRevisionListItem {
  const changedFields = listChangedBlogPostRevisionFields(doc.before, doc.after);
  return {
    id: doc._id.toString(),
    savedAtIso: doc.savedAt.toISOString(),
    changedFields,
    summary: buildBlogPostRevisionSummary(changedFields),
  };
}

async function getCollection(): Promise<Collection<BlogPostRevisionDocument>> {
  const db = await getDb();
  return db.collection<BlogPostRevisionDocument>(COLLECTIONS.blogPostRevisions);
}

export async function recordBlogPostRevision(params: {
  readonly postId: string;
  readonly before: BlogPostRevisionSnapshot;
  readonly after: BlogPostRevisionSnapshot;
}): Promise<void> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(params.postId)) {
    return;
  }
  const changedFields = listChangedBlogPostRevisionFields(params.before, params.after);
  if (changedFields.length === 0) {
    return;
  }
  const collection = await getCollection();
  const revisionDoc: BlogPostRevisionDocument = {
    postId: new ObjectId(params.postId),
    savedAt: new Date(),
    before: params.before,
    after: params.after,
  };
  await collection.insertOne(revisionDoc);
}

export async function listBlogPostRevisions(postId: string): Promise<BlogPostRevisionListItem[]> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(postId)) {
    return [];
  }
  const collection = await getCollection();
  const docs = await collection
    .find({ postId: new ObjectId(postId) })
    .sort({ savedAt: -1 })
    .toArray();
  return docs.map((doc) => mapRevisionListItem(doc as BlogPostRevisionStoredDocument));
}

export async function findBlogPostRevisionById(
  postId: string,
  revisionId: string,
): Promise<BlogPostRevisionDetail | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(postId) || !ObjectId.isValid(revisionId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne({
    _id: new ObjectId(revisionId),
    postId: new ObjectId(postId),
  });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  const stored = doc as BlogPostRevisionStoredDocument;
  return buildBlogPostRevisionDetail({
    id: stored._id.toString(),
    savedAtIso: stored.savedAt.toISOString(),
    before: stored.before,
    after: stored.after,
  });
}

export async function deleteBlogPostRevisionsForPost(postId: string): Promise<void> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(postId)) {
    return;
  }
  const collection = await getCollection();
  await collection.deleteMany({ postId: new ObjectId(postId) });
}
