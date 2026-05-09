import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

export type BookingRow = {
  id: string;
  leadId: string;
  visitorId: string;
  serviceKey: string;
  startsAtIso: string;
  timezone: string;
  status: BookingDocument['status'];
  meetingUrl?: string;
};

function mapBooking(
  doc: BookingDocument & { _id: { toString: () => string }; leadId: { toString: () => string } },
): BookingRow {
  return {
    id: doc._id.toString(),
    leadId: doc.leadId.toString(),
    visitorId: doc.visitorId,
    serviceKey: doc.serviceKey,
    startsAtIso: doc.startsAt.toISOString(),
    timezone: doc.timezone,
    status: doc.status,
    meetingUrl: doc.meetingUrl,
  };
}

export async function listBookings(limit = 500): Promise<BookingRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find()
    .sort({ startsAt: -1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs.map((doc) =>
    mapBooking(
      doc as BookingDocument & {
        _id: { toString: () => string };
        leadId: { toString: () => string };
      },
    ),
  );
}
