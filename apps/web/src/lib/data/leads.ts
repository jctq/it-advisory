import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { LeadDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

export type LeadRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  source: string;
  createdAtIso: string;
};

function mapLead(doc: LeadDocument & { _id: { toString: () => string } }): LeadRow {
  const emailRaw = doc.email;
  const email = typeof emailRaw === 'string' && emailRaw.trim().length > 0 ? emailRaw.trim() : '—';
  return {
    id: doc._id.toString(),
    name: doc.name,
    email,
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

export type MarketingBookingLeadContact = {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly phone: string;
};

/**
 * Inserts a lead row for a marketing booking. Uses placeholder copy when {@link contact} is omitted (legacy funnel).
 */
export async function insertMarketingBookingLead(
  visitorId: string,
  contact?: MarketingBookingLeadContact | null,
): Promise<ObjectId | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const doc: Omit<LeadDocument, '_id'> =
    contact !== undefined && contact !== null
      ? {
          visitorId,
          name: contact.name.trim(),
          email: contact.email.trim(),
          company: contact.company.trim().length > 0 ? contact.company.trim() : '—',
          phone: contact.phone.trim(),
          source: 'marketing-booking',
          createdAt: now,
        }
      : {
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

export type MarketingLeadContactRow = {
  readonly name: string;
  readonly email: string;
};

/**
 * Loads a marketing lead by id for transactional email and CRM reads.
 */
export async function findLeadById(leadIdHex: string): Promise<MarketingLeadContactRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(leadIdHex);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: objectId });
  if (doc === null) {
    return null;
  }
  const name = typeof doc.name === 'string' ? doc.name.trim() : '';
  const email = typeof doc.email === 'string' ? doc.email.trim() : '';
  return {
    name: name.length > 0 ? name : 'Customer',
    email,
  };
}
