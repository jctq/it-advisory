import type { ObjectId } from 'mongodb';

export type TestimonialStatus = 'draft' | 'published';

export type TestimonialDocument = {
  _id?: ObjectId;
  quote: string;
  name: string;
  role: string;
  status: TestimonialStatus;
  /** Lower values appear first on the marketing homepage. */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};
