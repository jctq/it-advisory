import { ObjectId, type Document } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type {
  BookingDocument,
  QuizAnswers,
  QuizAuditDocument,
  QuizSessionDocument,
  VisitorSessionDocument,
} from '@/domain/types';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { buildDiagnosticThreadJson, GUIDED_DIAGNOSTIC_EMPTY, serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import { getActiveDiagnosticTemplate } from '@/lib/data/diagnostic-templates';
import { getDb } from '@/lib/mongodb';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';

const DEFAULT_QUIZ_SESSION_LIST_LIMIT = 500;
const DEFAULT_QUIZ_AUDIT_LIST_LIMIT = 200;
const DEFAULT_VISITOR_SESSION_LIST_LIMIT = 50;
const SITUATION_PREVIEW_MAX_LENGTH = 120;

const BLANK_QUIZ_ANSWERS: QuizAnswers = {
  guidedDiagnostic: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
  situation: '',
  situationAdvisorSummary: '',
  situationDiagnosticThread: buildDiagnosticThreadJson(GUIDED_DIAGNOSTIC_EMPTY),
};

export type QuizSessionListRow = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly situationPreview: string | null;
  /** True when a booking references this session (`bookings.quizSessionId`). */
  readonly isBooked: boolean;
  /** First linked booking id for admin, when `isBooked`. */
  readonly bookingId: string | null;
};

export type QuizSessionLinkedBooking = {
  readonly id: string;
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly status: BookingDocument['status'];
};

export type QuizSessionDetail = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly guidedDiagnosticRaw: string | null;
  readonly situationDiagnosticThread: string | null;
  readonly linkedBookings: readonly QuizSessionLinkedBooking[];
};

export type QuizAuditAdminRow = {
  readonly id: string;
  readonly step: number;
  readonly createdAtIso: string;
  readonly answersJson: string;
};

function resolveSituationPreview(answers: QuizAnswers): string | null {
  const raw = answers.situation;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.length > SITUATION_PREVIEW_MAX_LENGTH
    ? `${trimmed.slice(0, SITUATION_PREVIEW_MAX_LENGTH)}…`
    : trimmed;
}

function resolveSituationDiagnosticThread(answers: QuizAnswers): string | null {
  const raw = answers.situationDiagnosticThread;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapQuizSessionListRow(
  doc: QuizSessionDocument & { _id: ObjectId },
  bookingId: string | null,
): QuizSessionListRow {
  const guidedRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
  return {
    id: doc._id.toString(),
    visitorId: doc.visitorId,
    currentStep: doc.currentStep,
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
    hasGuidedDiagnostic: guidedRaw !== null,
    situationPreview: resolveSituationPreview(doc.answers),
    isBooked: bookingId !== null,
    bookingId,
  };
}

type LinkedBookingSummary = {
  readonly bookingId: string;
  readonly bookingStatus: BookingDocument['status'];
  readonly bookingStartsAtIso: string;
  readonly bookingTimezone: string;
  readonly bookingServiceKey: string;
  readonly bookingMeetingUrl: string | null;
};

async function fetchPrimaryBookingIdByQuizSessionIds(sessionIds: readonly ObjectId[]): Promise<Map<string, string>> {
  const linked = await fetchPrimaryBookingByQuizSessionIds(sessionIds);
  const result = new Map<string, string>();
  for (const [sessionKey, booking] of linked) {
    result.set(sessionKey, booking.bookingId);
  }
  return result;
}

async function fetchPrimaryBookingByQuizSessionIds(
  sessionIds: readonly ObjectId[],
): Promise<Map<string, LinkedBookingSummary>> {
  const result = new Map<string, LinkedBookingSummary>();
  if (sessionIds.length === 0) {
    return result;
  }
  const db = await getDb();
  const docs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find(
      { quizSessionId: { $in: [...sessionIds] } },
      { projection: { _id: 1, quizSessionId: 1, status: 1, startsAt: 1, timezone: 1, serviceKey: 1, meetingUrl: 1 } },
    )
    .toArray();
  for (const doc of docs) {
    if (doc._id === undefined || doc.quizSessionId === undefined || doc.quizSessionId === null) {
      continue;
    }
    const sessionKey = doc.quizSessionId.toString();
    if (!result.has(sessionKey)) {
      const meetingRaw = doc.meetingUrl;
      const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
      result.set(sessionKey, {
        bookingId: doc._id.toString(),
        bookingStatus: doc.status,
        bookingStartsAtIso: doc.startsAt.toISOString(),
        bookingTimezone: doc.timezone,
        bookingServiceKey: doc.serviceKey,
        bookingMeetingUrl: meetingUrl,
      });
    }
  }
  return result;
}

export { formatBookingReferenceId };

/**
 * Admin list: all persisted quiz session snapshots (latest row per visitor when upserts target the same document).
 */
export async function listQuizSessionsForAdmin(
  limit: number = DEFAULT_QUIZ_SESSION_LIST_LIMIT,
): Promise<QuizSessionListRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .find()
    .sort({ updatedAt: -1 })
    .limit(limit);
  const docs = await cursor.toArray();
  const validDocs = docs.filter((doc): doc is QuizSessionDocument & { _id: ObjectId } => doc._id !== undefined);
  const sessionIds = validDocs.map((doc) => doc._id);
  const bookingIdBySessionId = await fetchPrimaryBookingIdByQuizSessionIds(sessionIds);
  return validDocs.map((doc) =>
    mapQuizSessionListRow(doc, bookingIdBySessionId.get(doc._id.toString()) ?? null),
  );
}

/**
 * Admin detail: one quiz session by Mongo `_id`.
 */
export async function findQuizSessionById(sessionId: string): Promise<QuizSessionDetail | null> {
  if (!hasMongoUri()) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionId);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).findOne({ _id: objectId });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  const guidedDiagnosticRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
  const linkedBookingDocs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({ quizSessionId: objectId })
    .sort({ startsAt: -1 })
    .toArray();
  const linkedBookings: QuizSessionLinkedBooking[] = linkedBookingDocs
    .filter((b): b is BookingDocument & { _id: ObjectId } => b._id !== undefined)
    .map((b) => {
      const meetingRaw = b.meetingUrl;
      const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
      return {
        id: b._id.toString(),
        startsAtIso: b.startsAt.toISOString(),
        timezone: b.timezone,
        serviceKey: b.serviceKey,
        meetingUrl,
        status: b.status,
      };
    });
  return {
    id: doc._id.toString(),
    visitorId: doc.visitorId,
    currentStep: doc.currentStep,
    createdAtIso: doc.createdAt.toISOString(),
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
    guidedDiagnosticRaw,
    situationDiagnosticThread: resolveSituationDiagnosticThread(doc.answers),
    linkedBookings,
  };
}

/**
 * Append-only save history for a session (`quiz_audit`).
 */
export async function listQuizAuditForSession(
  sessionId: ObjectId,
  limit: number = DEFAULT_QUIZ_AUDIT_LIST_LIMIT,
): Promise<QuizAuditAdminRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<QuizAuditDocument>(COLLECTIONS.quizAudit)
    .find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs
    .filter((doc): doc is QuizAuditDocument & { _id: ObjectId } => doc._id !== undefined)
    .map((doc) => ({
      id: doc._id.toString(),
      step: doc.step,
      createdAtIso: doc.createdAt.toISOString(),
      answersJson: safeStringifyAnswers(doc.answersSnapshot),
    }));
}

function safeStringifyAnswers(answers: QuizAnswers): string {
  try {
    return JSON.stringify(answers, null, 2);
  } catch {
    return '{}';
  }
}

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

async function resolveActiveDiagnosticTemplateObjectId(): Promise<ObjectId | null> {
  const template = await getActiveDiagnosticTemplate();
  if (template === null) {
    return null;
  }
  if (!ObjectId.isValid(template.id)) {
    return null;
  }
  return new ObjectId(template.id);
}

export async function findIncompleteQuizSession(visitorId: string): Promise<QuizSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .findOne({ visitorId, completedAt: { $exists: false } }, { sort: { updatedAt: -1 } });
  return doc;
}

/**
 * Latest quiz row for this visitor (complete or not). Used to restore guided diagnostic answers after finishing.
 */
export async function findLatestQuizSession(visitorId: string): Promise<QuizSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .findOne({ visitorId }, { sort: { updatedAt: -1 } });
}

/**
 * Session to attach at booking time: prefers `visitor_sessions.latestSessionId` (matches `/quiz/[sessionRef]` saves)
 * over a raw `updatedAt` sort, which can pick a different row if multiple sessions exist.
 */
export async function findQuizSessionForBookingSnapshot(visitorId: string): Promise<QuizSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const pointer = await db
    .collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions)
    .findOne({ visitorId });
  if (pointer?.latestSessionId !== undefined && pointer.latestSessionId !== null) {
    const preferred = await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).findOne({
      _id: pointer.latestSessionId,
      visitorId,
    });
    if (preferred !== null) {
      return preferred;
    }
  }
  return findLatestQuizSession(visitorId);
}

export type VisitorQuizSessionListStatusFilter = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'all';

export type PaginatedVisitorQuizSessionsResult = {
  readonly sessions: readonly VisitorQuizSessionSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasAnySessions: boolean;
};

export type VisitorQuizSessionSummary = {
  readonly id: string;
  /** Value for `/quiz/[sessionRef]` links and quiz session API calls (opaque when `QUIZ_SESSION_URL_SECRET` is set). */
  readonly marketingSessionRef: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly situationPreview: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly isBooked: boolean;
  readonly bookingId: string | null;
  /** Display/search token derived from {@link bookingId} (last 8 hex chars, uppercase). */
  readonly bookingReferenceId: string | null;
  readonly bookingStatus: BookingDocument['status'] | null;
  readonly bookingStartsAtIso: string | null;
  readonly bookingTimezone: string | null;
  readonly bookingServiceKey: string | null;
  readonly bookingMeetingUrl: string | null;
};

function mapVisitorQuizSessionSummary(
  doc: QuizSessionDocument & { _id: ObjectId },
  linkedBooking: LinkedBookingSummary | null,
): VisitorQuizSessionSummary {
  const guidedRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
  const idHex = doc._id.toString();
  const bookingId = linkedBooking?.bookingId ?? null;
  return {
    id: idHex,
    marketingSessionRef: encodeQuizSessionRefForMarketingUrl(idHex),
    currentStep: doc.currentStep,
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
    situationPreview: resolveSituationPreview(doc.answers),
    hasGuidedDiagnostic: guidedRaw !== null,
    isBooked: bookingId !== null,
    bookingId,
    bookingReferenceId: bookingId !== null ? formatBookingReferenceId(bookingId) : null,
    bookingStatus: linkedBooking?.bookingStatus ?? null,
    bookingStartsAtIso: linkedBooking?.bookingStartsAtIso ?? null,
    bookingTimezone: linkedBooking?.bookingTimezone ?? null,
    bookingServiceKey: linkedBooking?.bookingServiceKey ?? null,
    bookingMeetingUrl: linkedBooking?.bookingMeetingUrl ?? null,
  };
}

/**
 * Lists persisted quiz rows for a visitor id (e.g. `acct:<userId>` or anonymous cookie id), newest first.
 */
export async function listQuizSessionsForVisitor(
  visitorId: string,
  limit: number = DEFAULT_VISITOR_SESSION_LIST_LIMIT,
): Promise<VisitorQuizSessionSummary[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .find({ visitorId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  const validDocs = docs.filter((doc): doc is QuizSessionDocument & { _id: ObjectId } => doc._id !== undefined);
  const sessionIds = validDocs.map((doc) => doc._id);
  const bookingBySessionId = await fetchPrimaryBookingByQuizSessionIds(sessionIds);
  return validDocs.map((doc) =>
    mapVisitorQuizSessionSummary(doc, bookingBySessionId.get(doc._id.toString()) ?? null),
  );
}

function buildVisitorSessionStatusMatch(status: VisitorQuizSessionListStatusFilter): Document {
  switch (status) {
    case 'all':
      return {};
    case 'pending':
      return {
        $or: [
          { 'linkedBooking.status': 'pending' },
          {
            $and: [
              { linkedBooking: null },
              { $or: [{ completedAt: { $exists: false } }, { completedAt: null }] },
            ],
          },
        ],
      };
    case 'confirmed':
      return { 'linkedBooking.status': 'confirmed' };
    case 'cancelled':
      return { 'linkedBooking.status': 'cancelled' };
    case 'completed':
      return { completedAt: { $exists: true, $ne: null } };
    default:
      return {};
  }
}

type AggregatedVisitorQuizSessionRow = QuizSessionDocument & {
  _id: ObjectId;
  linkedBooking: {
    _id: ObjectId;
    status: BookingDocument['status'];
    startsAt: Date;
    timezone: string;
    serviceKey: string;
    meetingUrl?: string;
  } | null;
};

/**
 * Paginated account diagnostics list with server-side status and booking-reference filters.
 */
export async function listQuizSessionsForVisitorPaginated(input: {
  readonly visitorId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status: VisitorQuizSessionListStatusFilter;
  readonly bookingReference?: string;
}): Promise<PaginatedVisitorQuizSessionsResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(50, Math.max(1, input.pageSize));
  const emptyResult: PaginatedVisitorQuizSessionsResult = {
    sessions: [],
    totalCount: 0,
    page,
    pageSize,
    totalPages: 0,
    hasAnySessions: false,
  };
  if (!hasMongoUri()) {
    return emptyResult;
  }
  const db = await getDb();
  const hasAnySessions =
    (await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).countDocuments(
      { visitorId: input.visitorId },
      { limit: 1 },
    )) > 0;
  const pipeline: Document[] = [
    { $match: { visitorId: input.visitorId } },
    {
      $lookup: {
        from: COLLECTIONS.bookings,
        let: { sessionId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$quizSessionId', '$$sessionId'] } } },
          { $sort: { createdAt: 1 } },
          { $limit: 1 },
          { $project: { _id: 1, status: 1, startsAt: 1, timezone: 1, serviceKey: 1, meetingUrl: 1 } },
        ],
        as: 'linkedBookings',
      },
    },
    { $addFields: { linkedBooking: { $arrayElemAt: ['$linkedBookings', 0] } } },
  ];
  const statusMatch = buildVisitorSessionStatusMatch(input.status);
  if (Object.keys(statusMatch).length > 0) {
    pipeline.push({ $match: statusMatch });
  }
  const bookingReference = input.bookingReference?.trim() ?? '';
  if (bookingReference.length > 0) {
    const escapedReference = bookingReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pipeline.push({
      $match: {
        linkedBooking: { $ne: null },
        $expr: {
          $regexMatch: {
            input: { $toString: '$linkedBooking._id' },
            regex: escapedReference,
            options: 'i',
          },
        },
      },
    });
  }
  const skip = (page - 1) * pageSize;
  pipeline.push({
    $facet: {
      total: [{ $count: 'count' }],
      rows: [{ $sort: { updatedAt: -1 } }, { $skip: skip }, { $limit: pageSize }],
    },
  });
  const facetRows = await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).aggregate(pipeline).toArray();
  const facetResult = facetRows[0] as { total?: { count: number }[]; rows?: AggregatedVisitorQuizSessionRow[] } | undefined;
  const totalCount = facetResult?.total?.[0]?.count ?? 0;
  const rows = facetResult?.rows ?? [];
  const sessions = rows.map((row) => {
    const linkedBooking =
      row.linkedBooking !== null && row.linkedBooking !== undefined
        ? (() => {
            const meetingRaw = row.linkedBooking.meetingUrl;
            const meetingUrl =
              typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
            return {
              bookingId: row.linkedBooking._id.toString(),
              bookingStatus: row.linkedBooking.status,
              bookingStartsAtIso: row.linkedBooking.startsAt.toISOString(),
              bookingTimezone: row.linkedBooking.timezone,
              bookingServiceKey: row.linkedBooking.serviceKey,
              bookingMeetingUrl: meetingUrl,
            };
          })()
        : null;
    return mapVisitorQuizSessionSummary(row, linkedBooking);
  });
  return {
    sessions,
    totalCount,
    page,
    pageSize,
    totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    hasAnySessions,
  };
}

/**
 * Loads one quiz session when it belongs to the given visitor id.
 */
export async function findQuizSessionForVisitor(
  visitorId: string,
  sessionId: string,
): Promise<QuizSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionId);
  } catch {
    return null;
  }
  const db = await getDb();
  return db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).findOne({
    _id: objectId,
    visitorId,
  });
}

export type DeleteQuizSessionForVisitorResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'not_found' | 'has_booking' };

/**
 * Removes a quiz session and its audit rows when it belongs to the visitor and is not linked from a booking
 * (in-progress or completed).
 */
export async function deleteQuizSessionForVisitor(visitorId: string, sessionId: string): Promise<DeleteQuizSessionForVisitorResult> {
  if (!hasMongoUri()) {
    return { ok: false, code: 'not_found' };
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionId);
  } catch {
    return { ok: false, code: 'not_found' };
  }
  const db = await getDb();
  const sessions = db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions);
  const existing = await sessions.findOne({ _id: objectId, visitorId });
  if (existing === null) {
    return { ok: false, code: 'not_found' };
  }
  const bookingCount = await db
    .collection(COLLECTIONS.bookings)
    .countDocuments({ quizSessionId: objectId });
  if (bookingCount > 0) {
    return { ok: false, code: 'has_booking' };
  }
  await db.collection<QuizAuditDocument>(COLLECTIONS.quizAudit).deleteMany({ sessionId: objectId });
  await sessions.deleteOne({ _id: objectId });
  const pointer = await db.collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions).findOne({ visitorId });
  if (pointer?.latestSessionId?.equals(objectId) === true) {
    const nextLatest = await sessions.findOne({ visitorId }, { sort: { updatedAt: -1 } });
    if (nextLatest !== null && nextLatest._id !== undefined) {
      await upsertVisitorSessionPointer(visitorId, nextLatest._id);
    } else {
      await db.collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions).deleteOne({ visitorId });
    }
  }
  return { ok: true };
}

/**
 * Inserts a new empty quiz session for this visitor and points `visitor_sessions` at it.
 */
export async function insertBlankQuizSessionForVisitor(visitorId: string): Promise<string | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const sessions = db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions);
  const now = new Date();
  const templateObjectId = await resolveActiveDiagnosticTemplateObjectId();
  const insertDoc: Omit<QuizSessionDocument, '_id'> = {
    visitorId,
    answers: BLANK_QUIZ_ANSWERS,
    currentStep: 0,
    createdAt: now,
    updatedAt: now,
    ...(templateObjectId !== null ? { diagnosticTemplateId: templateObjectId } : {}),
  };
  const insertResult = await sessions.insertOne(insertDoc);
  await insertQuizAudit({
    visitorId,
    sessionId: insertResult.insertedId,
    step: 0,
    answersSnapshot: BLANK_QUIZ_ANSWERS,
  });
  await upsertVisitorSessionPointer(visitorId, insertResult.insertedId);
  return insertResult.insertedId.toString();
}

async function insertQuizAudit(input: {
  readonly visitorId: string;
  readonly sessionId: ObjectId;
  readonly step: number;
  readonly answersSnapshot: QuizAnswers;
}): Promise<void> {
  const db = await getDb();
  const auditDoc: QuizAuditDocument = {
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    step: input.step,
    answersSnapshot: input.answersSnapshot,
    createdAt: new Date(),
  };
  await db.collection<QuizAuditDocument>(COLLECTIONS.quizAudit).insertOne(auditDoc);
}

async function upsertVisitorSessionPointer(visitorId: string, sessionId: ObjectId): Promise<void> {
  const db = await getDb();
  const doc: VisitorSessionDocument = {
    visitorId,
    latestSessionId: sessionId,
    updatedAt: new Date(),
  };
  await db.collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions).updateOne(
    { visitorId },
    { $set: doc },
    { upsert: true },
  );
}

export type UpsertQuizProgressInput = {
  readonly visitorId: string;
  readonly answers: QuizAnswers;
  readonly currentStep: number;
  readonly isComplete: boolean;
  /** When set, updates this session row after verifying `visitorId` ownership. */
  readonly targetSessionId?: string | null;
};

export type UpsertQuizProgressResult = {
  readonly persisted: boolean;
  readonly sessionId?: string;
};

/**
 * Creates or updates the visitor's in-progress quiz session and writes an audit row.
 */
export async function upsertQuizProgress(input: UpsertQuizProgressInput): Promise<UpsertQuizProgressResult> {
  if (!hasMongoUri()) {
    return { persisted: false };
  }
  const db = await getDb();
  const sessions = db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions);
  const now = new Date();
  const setFields: Record<string, unknown> = {
    answers: input.answers,
    currentStep: input.currentStep,
    updatedAt: now,
  };
  if (input.isComplete) {
    setFields.completedAt = now;
  }
  let target: (QuizSessionDocument & { _id: ObjectId }) | null = null;
  const rawTargetId = input.targetSessionId?.trim();
  if (rawTargetId !== undefined && rawTargetId.length > 0) {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(rawTargetId);
    } catch {
      return { persisted: false };
    }
    const found = await sessions.findOne({ _id: objectId, visitorId: input.visitorId });
    if (found === null || found._id === undefined) {
      return { persisted: false };
    }
    target = found as QuizSessionDocument & { _id: ObjectId };
  } else {
    const latest = await sessions.findOne({ visitorId: input.visitorId }, { sort: { updatedAt: -1 } });
    if (latest !== null && latest._id !== undefined) {
      target = latest as QuizSessionDocument & { _id: ObjectId };
    }
  }
  if (target !== null) {
    const templatePinToSet =
      target.diagnosticTemplateId !== undefined && target.diagnosticTemplateId !== null
        ? null
        : await resolveActiveDiagnosticTemplateObjectId();
    const setWithTemplatePin: Record<string, unknown> = {
      ...setFields,
      ...(templatePinToSet !== null ? { diagnosticTemplateId: templatePinToSet } : {}),
    };
    if (input.isComplete) {
      await sessions.updateOne({ _id: target._id }, { $set: setWithTemplatePin });
    } else {
      await sessions.updateOne(
        { _id: target._id },
        {
          $set: setWithTemplatePin,
          $unset: { completedAt: '' },
        },
      );
    }
    await insertQuizAudit({
      visitorId: input.visitorId,
      sessionId: target._id,
      step: input.currentStep,
      answersSnapshot: input.answers,
    });
    await upsertVisitorSessionPointer(input.visitorId, target._id);
    return { persisted: true, sessionId: target._id.toString() };
  }
  const insertTemplateId = await resolveActiveDiagnosticTemplateObjectId();
  const insertDoc: Omit<QuizSessionDocument, '_id'> = {
    visitorId: input.visitorId,
    answers: input.answers,
    currentStep: input.currentStep,
    createdAt: now,
    updatedAt: now,
    ...(input.isComplete ? { completedAt: now } : {}),
    ...(insertTemplateId !== null ? { diagnosticTemplateId: insertTemplateId } : {}),
  };
  const insertResult = await sessions.insertOne(insertDoc);
  await insertQuizAudit({
    visitorId: input.visitorId,
    sessionId: insertResult.insertedId,
    step: input.currentStep,
    answersSnapshot: input.answers,
  });
  await upsertVisitorSessionPointer(input.visitorId, insertResult.insertedId);
  return { persisted: true, sessionId: insertResult.insertedId.toString() };
}
