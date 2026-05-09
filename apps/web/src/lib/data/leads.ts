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
