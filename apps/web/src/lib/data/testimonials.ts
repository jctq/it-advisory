import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { TestimonialDocument, TestimonialStatus } from '@/domain/testimonial-types';
import type {
  CreateTestimonialInput,
  PublishedMarketingTestimonial,
  TestimonialValue,
  UpdateTestimonialInput,
} from '@/lib/testimonial-types';
import { getDb } from '@/lib/mongodb';

export type { CreateTestimonialInput, PublishedMarketingTestimonial, TestimonialValue, UpdateTestimonialInput };

type TestimonialStoredDocument = TestimonialDocument & {
  readonly _id: ObjectId;
};

function normalizeText(value: string | undefined, maxLength: number): string {
  const trimmedValue = value?.trim() ?? '';
  if (trimmedValue.length > maxLength) {
    return trimmedValue.slice(0, maxLength);
  }
  return trimmedValue;
}

function clampSortOrder(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 9999) {
    return 9999;
  }
  return rounded;
}

function mapTestimonial(doc: TestimonialStoredDocument): TestimonialValue {
  return {
    id: doc._id.toString(),
    quote: doc.quote,
    name: doc.name,
    role: doc.role,
    status: doc.status,
    sortOrder: doc.sortOrder,
    createdAtIso: doc.createdAt.toISOString(),
    updatedAtIso: doc.updatedAt.toISOString(),
  };
}

function mapPublishedMarketingTestimonial(doc: TestimonialStoredDocument): PublishedMarketingTestimonial {
  return {
    quote: doc.quote,
    name: doc.name,
    role: doc.role,
  };
}

async function getCollection(): Promise<Collection<TestimonialDocument>> {
  const db = await getDb();
  return db.collection<TestimonialDocument>(COLLECTIONS.testimonials);
}

async function resolveNextSortOrder(): Promise<number> {
  const collection = await getCollection();
  const doc = await collection.find({}).sort({ sortOrder: -1 }).limit(1).next();
  if (doc === null) {
    return 0;
  }
  return doc.sortOrder + 1;
}

export async function listTestimonials(): Promise<TestimonialValue[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const collection = await getCollection();
  const docs = await collection.find({}).sort({ sortOrder: 1, updatedAt: -1 }).toArray();
  return docs.map((doc) => mapTestimonial(doc as TestimonialStoredDocument));
}

export async function listPublishedMarketingTestimonials(): Promise<PublishedMarketingTestimonial[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const collection = await getCollection();
  const docs = await collection
    .find({ status: 'published' as const })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .toArray();
  return docs
    .filter((doc) => doc.quote.trim().length > 0 && doc.name.trim().length > 0)
    .map((doc) => mapPublishedMarketingTestimonial(doc as TestimonialStoredDocument));
}

export async function findTestimonialById(testimonialId: string): Promise<TestimonialValue | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(testimonialId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(testimonialId) });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return mapTestimonial(doc as TestimonialStoredDocument);
}

export async function createTestimonial(input: CreateTestimonialInput = {}): Promise<TestimonialValue> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to manage testimonials.');
  }
  const collection = await getCollection();
  const now = new Date();
  const status: TestimonialStatus = input.status ?? 'draft';
  const doc: TestimonialDocument = {
    quote: normalizeText(input.quote, 500),
    name: normalizeText(input.name, 120),
    role: normalizeText(input.role, 120),
    status,
    sortOrder: input.sortOrder === undefined ? await resolveNextSortOrder() : clampSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(doc);
  return mapTestimonial({ ...doc, _id: result.insertedId });
}

export async function updateTestimonial(
  testimonialId: string,
  input: UpdateTestimonialInput,
): Promise<TestimonialValue> {
  if (!ObjectId.isValid(testimonialId)) {
    throw new Error('Invalid testimonial id.');
  }
  const collection = await getCollection();
  const current = await collection.findOne({ _id: new ObjectId(testimonialId) });
  if (current === null || current._id === undefined) {
    throw new Error('Testimonial not found.');
  }
  const now = new Date();
  const setFields: Partial<TestimonialDocument> = { updatedAt: now };
  if (input.quote !== undefined) {
    setFields.quote = normalizeText(input.quote, 500);
  }
  if (input.name !== undefined) {
    setFields.name = normalizeText(input.name, 120);
  }
  if (input.role !== undefined) {
    setFields.role = normalizeText(input.role, 120);
  }
  if (input.status !== undefined) {
    setFields.status = input.status;
  }
  if (input.sortOrder !== undefined) {
    setFields.sortOrder = clampSortOrder(input.sortOrder);
  }
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(testimonialId) },
    { $set: setFields },
    { returnDocument: 'after' },
  );
  if (result === null || result._id === undefined) {
    throw new Error('Testimonial not found.');
  }
  return mapTestimonial(result as TestimonialStoredDocument);
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  if (!ObjectId.isValid(testimonialId)) {
    throw new Error('Invalid testimonial id.');
  }
  const collection = await getCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(testimonialId) });
  if (result.deletedCount === 0) {
    throw new Error('Testimonial not found.');
  }
}
