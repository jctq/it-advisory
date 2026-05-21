import 'server-only';
import { Binary, ObjectId, type Collection } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BlogImageDocument } from '@/domain/blog-image-types';
import { getDb } from '@/lib/mongodb';

const MAX_BLOG_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_BLOG_IMAGE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export type BlogImageValue = {
  readonly id: string;
  readonly contentType: string;
  readonly byteLength: number;
  readonly originalFilename: string | null;
  readonly createdAtIso: string;
  readonly publicUrl: string;
};

type BlogImageStoredDocument = BlogImageDocument & {
  readonly _id: ObjectId;
};

function mapBlogImage(doc: BlogImageStoredDocument): BlogImageValue {
  const id = doc._id.toString();
  return {
    id,
    contentType: doc.contentType,
    byteLength: doc.byteLength,
    originalFilename: doc.originalFilename,
    createdAtIso: doc.createdAt.toISOString(),
    publicUrl: `/api/blog-images/${id}`,
  };
}

async function getCollection(): Promise<Collection<BlogImageDocument>> {
  const db = await getDb();
  return db.collection<BlogImageDocument>(COLLECTIONS.blogImages);
}

export function isAllowedBlogImageContentType(contentType: string): boolean {
  return ALLOWED_BLOG_IMAGE_CONTENT_TYPES.has(contentType);
}

export function getMaxBlogImageBytes(): number {
  return MAX_BLOG_IMAGE_BYTES;
}

export async function createBlogImage(params: {
  readonly contentType: string;
  readonly buffer: Buffer;
  readonly originalFilename: string | null;
}): Promise<BlogImageValue> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to upload blog images.');
  }
  if (!isAllowedBlogImageContentType(params.contentType)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, GIF, or WebP.');
  }
  if (params.buffer.byteLength === 0) {
    throw new Error('Image file is empty.');
  }
  if (params.buffer.byteLength > MAX_BLOG_IMAGE_BYTES) {
    throw new Error('Image is too large. Maximum size is 5 MB.');
  }
  const collection = await getCollection();
  const now = new Date();
  const doc: BlogImageDocument = {
    contentType: params.contentType,
    data: new Binary(params.buffer),
    byteLength: params.buffer.byteLength,
    originalFilename: params.originalFilename,
    createdAt: now,
  };
  const result = await collection.insertOne(doc);
  return mapBlogImage({ ...doc, _id: result.insertedId });
}

export async function findBlogImageById(imageId: string): Promise<BlogImageValue | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(imageId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(imageId) });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return mapBlogImage(doc as BlogImageStoredDocument);
}

export async function readBlogImageBuffer(imageId: string): Promise<{
  readonly contentType: string;
  readonly buffer: Buffer;
} | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(imageId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne(
    { _id: new ObjectId(imageId) },
    { projection: { contentType: 1, data: 1 } },
  );
  if (doc === null || doc.data === undefined) {
    return null;
  }
  const buffer = Buffer.from(doc.data.buffer);
  return { contentType: doc.contentType, buffer };
}
