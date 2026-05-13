import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { LeadDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

export type LeadRow = {
  id: string;
  name: string;
  company: string;
  phone: string;
  source: string;
  createdAtIso: string;
};

function mapLead(doc: LeadDocument & { _id: { toString: () => string } }): LeadRow {
  return {
    id: doc._id.toString(),
    name: doc.name,
    company: doc.company,
    phone: doc.phone,
    source: doc.source,
    createdAtIso: doc.createdAt.toISOString(),
  };
}

export async function listLeads(limit = 500): Promise<LeadRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<LeadDocument>(COLLECTIONS.leads)
    .find()
    .sort({ createdAt: -1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs.map((doc) => mapLead(doc as LeadDocument & { _id: { toString: () => string } }));
}

/**
 * Inserts a minimal lead row for an anonymous marketing booking (ties booking to visitor).
 */
export async function insertMarketingBookingLead(visitorId: string): Promise<ObjectId | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const doc: Omit<LeadDocument, '_id'> = {
    visitorId,
    name: 'Booking (funnel)',
    company: '—',
    phone: '—',
    source: 'marketing-booking',
    createdAt: now,
  };
  const result = await db.collection<LeadDocument>(COLLECTIONS.leads).insertOne(doc);
  return result.insertedId;
}
