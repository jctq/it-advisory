import type { Binary, ObjectId } from 'mongodb';

/** Binary blog image stored in MongoDB and served from `/api/blog-images/[id]`. */
export type BlogImageDocument = {
  _id?: ObjectId;
  contentType: string;
  data: Binary;
  byteLength: number;
  originalFilename: string | null;
  createdAt: Date;
};
