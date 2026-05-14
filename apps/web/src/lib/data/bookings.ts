/**
 * Marketing booking persistence. Booking documents are append-only in this application:
 * there is no delete path (API or data layer) so CRM history and slot confirmations stay auditable.
 */
import { MongoServerError, ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { getDb } from '@/lib/mongodb';
import { findQuizSessionForBookingSnapshot, findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';

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
  readonly paymentMethodLabel?: string | null;
};

export type InsertMarketingBookingResult =
  | { readonly kind: 'inserted'; readonly id: ObjectId }
  | { readonly kind: 'duplicate_key' }
  | null;

export async function insertMarketingBooking(input: CreateMarketingBookingInput): Promise<InsertMarketingBookingResult> {
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
    paymentMethodLabel: input.paymentMethodLabel ?? null,
    guidedDiagnosticSnapshot: input.guidedDiagnosticSnapshot,
    quizSessionId: input.quizSessionId,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await db.collection<BookingDocument>(COLLECTIONS.bookings).insertOne(doc);
    return { kind: 'inserted', id: result.insertedId };
  } catch (error: unknown) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return { kind: 'duplicate_key' };
    }
    throw error;
  }
}

/**
 * Persists a booking with the quiz diagnostic snapshot for this visitor (full rounds / questions / options).
 * Prefers {@link input.preferredQuizSessionId} when provided and owned by the visitor; otherwise uses the visitor
 * session pointer / latest row (see {@link findQuizSessionForBookingSnapshot}).
 */
export async function createBookingWithLatestQuizSnapshot(input: {
  readonly visitorId: string;
  readonly serviceKey: string;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly leadId: ObjectId;
  readonly preferredQuizSessionId?: string | null;
  readonly paymentMethodLabel?: string | null;
}): Promise<{ readonly bookingId: ObjectId; readonly quizSessionId: ObjectId | null } | 'duplicate_key' | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const preferredRaw = input.preferredQuizSessionId?.trim() ?? '';
  let session =
    preferredRaw.length > 0 && /^[a-f\d]{24}$/i.test(preferredRaw)
      ? await findQuizSessionForVisitor(input.visitorId, preferredRaw)
      : null;
  if (session === null) {
    session = await findQuizSessionForBookingSnapshot(input.visitorId);
  }
  const quizSessionId = session?._id ?? null;
  const snapshot =
    session !== null && session.answers !== undefined
      ? extractGuidedDiagnosticRawFromQuizAnswers(session.answers)
      : null;
  const inserted = await insertMarketingBooking({
    visitorId: input.visitorId,
    serviceKey: input.serviceKey,
    startsAt: input.startsAt,
    timezone: input.timezone,
    leadId: input.leadId,
    quizSessionId,
    guidedDiagnosticSnapshot: snapshot,
    paymentMethodLabel: input.paymentMethodLabel ?? null,
  });
  if (inserted === null) {
    return null;
  }
  if (inserted.kind === 'duplicate_key') {
    return 'duplicate_key';
  }
  return { bookingId: inserted.id, quizSessionId };
}

/**
 * Re-attachs a visitor-owned quiz session (and snapshot) to an existing booking row — used when the slot POST
 * dedupes because the visitor already reserved that time but is linking a different diagnostic session.
 */
export async function linkQuizSessionToVisitorBooking(input: {
  readonly bookingId: ObjectId;
  readonly visitorId: string;
  readonly quizSessionIdHex: string;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const session = await findQuizSessionForVisitor(input.visitorId, input.quizSessionIdHex.trim());
  if (session === null || session._id === undefined) {
    return false;
  }
  const snapshot = extractGuidedDiagnosticRawFromQuizAnswers(session.answers);
  const db = await getDb();
  const result = await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    {
      _id: input.bookingId,
      visitorId: input.visitorId,
    },
    {
      $set: {
        quizSessionId: session._id,
        guidedDiagnosticSnapshot: snapshot,
        updatedAt: new Date(),
      },
    },
  );
  return result.matchedCount === 1;
}

/**
 * When the same slot is POSTed again (dedupe), updates `quizSessionId` + snapshot from the visitor's current
 * booking pointer session if it has saved guided content and differs from the row already on the booking.
 */
export async function syncBookingQuizSessionIfPointerChanged(input: {
  readonly bookingId: ObjectId;
  readonly visitorId: string;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const db = await getDb();
  const booking = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({
    _id: input.bookingId,
    visitorId: input.visitorId,
  });
  if (booking === null) {
    return false;
  }
  const session = await findQuizSessionForBookingSnapshot(input.visitorId);
  if (session === null || session._id === undefined) {
    return false;
  }
  const snapshot = extractGuidedDiagnosticRawFromQuizAnswers(session.answers);
  if (snapshot === null || snapshot.trim().length === 0) {
    return false;
  }
  const previousId = booking.quizSessionId ?? null;
  if (previousId !== null && previousId.equals(session._id)) {
    return false;
  }
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: input.bookingId, visitorId: input.visitorId },
    {
      $set: {
        quizSessionId: session._id,
        guidedDiagnosticSnapshot: snapshot,
        updatedAt: new Date(),
      },
    },
  );
  return true;
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

/**
 * Returns how many bookings reference this quiz session id.
 */
export async function countBookingsByQuizSessionId(sessionId: ObjectId): Promise<number> {
  if (!process.env.MONGODB_URI) {
    return 0;
  }
  const db = await getDb();
  return db.collection<BookingDocument>(COLLECTIONS.bookings).countDocuments({ quizSessionId: sessionId });
}
