import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { getDb } from '@/lib/mongodb';
import { findLatestQuizSession } from '@/lib/data/quiz-sessions';

export type BookingRow = {
  id: string;
  leadId: string;
  visitorId: string;
  serviceKey: string;
  startsAtIso: string;
  timezone: string;
  status: BookingDocument['status'];
  meetingUrl?: string;
  hasDiagnosticSnapshot: boolean;
  /** Quiz session document id captured at booking time, when Mongo had a session row. */
  quizSessionId: string | null;
};

function mapBooking(
  doc: BookingDocument & { _id: { toString: () => string }; leadId: { toString: () => string } },
): BookingRow {
  const quizSessionId =
    doc.quizSessionId !== undefined && doc.quizSessionId !== null ? doc.quizSessionId.toString() : null;
  return {
    id: doc._id.toString(),
    leadId: doc.leadId.toString(),
    visitorId: doc.visitorId,
    serviceKey: doc.serviceKey,
    startsAtIso: doc.startsAt.toISOString(),
    timezone: doc.timezone,
    status: doc.status,
    meetingUrl: doc.meetingUrl,
    hasDiagnosticSnapshot:
      typeof doc.guidedDiagnosticSnapshot === 'string' && doc.guidedDiagnosticSnapshot.trim().length > 0,
    quizSessionId,
  };
}

/** Admin list: high default cap so the paginated client table can page through all stored bookings. */
export async function listBookings(limit = 10_000): Promise<BookingRow[]> {
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

export type BookingDetailRow = BookingRow & {
  guidedDiagnosticSnapshot: string | null;
};

function mapBookingDetail(
  doc: BookingDocument & { _id: { toString: () => string }; leadId: { toString: () => string } },
): BookingDetailRow {
  const base = mapBooking(doc);
  const raw = doc.guidedDiagnosticSnapshot;
  const guidedDiagnosticSnapshot =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  return {
    ...base,
    guidedDiagnosticSnapshot,
  };
}

export async function findBookingById(bookingId: string): Promise<BookingDetailRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(bookingId);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: objectId });
  if (!doc) {
    return null;
  }
  return mapBookingDetail(
    doc as BookingDocument & {
      _id: { toString: () => string };
      leadId: { toString: () => string };
    },
  );
}

export type CreateMarketingBookingInput = {
  readonly visitorId: string;
  readonly serviceKey: string;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly leadId: ObjectId;
  readonly quizSessionId: ObjectId | null;
  readonly guidedDiagnosticSnapshot: string | null;
};

export async function insertMarketingBooking(input: CreateMarketingBookingInput): Promise<ObjectId | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const now = new Date();
  const doc: Omit<BookingDocument, '_id'> = {
    leadId: input.leadId,
    visitorId: input.visitorId,
    serviceKey: input.serviceKey,
    startsAt: input.startsAt,
    timezone: input.timezone,
    status: 'pending',
    guidedDiagnosticSnapshot: input.guidedDiagnosticSnapshot,
    quizSessionId: input.quizSessionId,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<BookingDocument>(COLLECTIONS.bookings).insertOne(doc);
  return result.insertedId;
}

/**
 * Persists a booking with the latest quiz diagnostic snapshot for this visitor (full rounds / questions / options).
 */
export async function createBookingWithLatestQuizSnapshot(input: {
  readonly visitorId: string;
  readonly serviceKey: string;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly leadId: ObjectId;
}): Promise<{ readonly bookingId: ObjectId; readonly quizSessionId: ObjectId | null } | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const session = await findLatestQuizSession(input.visitorId);
  const quizSessionId = session?._id ?? null;
  const snapshot =
    session !== null && session.answers !== undefined
      ? extractGuidedDiagnosticRawFromQuizAnswers(session.answers)
      : null;
  const bookingId = await insertMarketingBooking({
    visitorId: input.visitorId,
    serviceKey: input.serviceKey,
    startsAt: input.startsAt,
    timezone: input.timezone,
    leadId: input.leadId,
    quizSessionId,
    guidedDiagnosticSnapshot: snapshot,
  });
  if (bookingId === null) {
    return null;
  }
  return { bookingId, quizSessionId };
}

export async function findBookingByVisitorSlot(input: {
  readonly visitorId: string;
  readonly serviceKey: string;
  readonly startsAt: Date;
}): Promise<ObjectId | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    {
      visitorId: input.visitorId,
      serviceKey: input.serviceKey,
      startsAt: input.startsAt,
    },
    { projection: { _id: 1 } },
  );
  return doc?._id ?? null;
}
