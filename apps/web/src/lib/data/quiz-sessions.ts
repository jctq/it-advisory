import { ObjectId, type Document } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type {
  BookingDocument,
  QuizAnswers,
  QuizAuditDocument,
  QuizSessionDocument,
  VisitorSessionDocument,
} from '@/domain/types';
import type { PaymentStatus } from '@/domain/payment-types';
import { fetchLatestPaymentTransactionsByQuizSessionIds } from '@/lib/data/payment-transactions';
import { resolveQuizSessionDiagnosticCompleted } from '@techmd/diagnostic-core/quiz-session-diagnostic-complete';
import { resolveQuizSessionDisplayPreview } from '@techmd/diagnostic-core/quiz-session-display-preview';
import { resolveQuizSessionSummaryDisplayPreview } from '@/lib/marketing/quiz-session-summary-display';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { buildDiagnosticThreadJson, GUIDED_DIAGNOSTIC_EMPTY, serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import { getActiveDiagnosticTemplate } from '@/lib/data/diagnostic-templates';
import { getDb } from '@/lib/mongodb';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import {
  normalizeBookingDocumentStatus,
  pickPrimaryBookingForQuizSession,
} from '@/lib/data/pick-primary-booking-for-quiz-session';
import { buildAccountDiagnosticsBookingStatusMatch } from '@/lib/marketing/account-booking-status';
import {
  normalizeVisitorQuizSessionListStatusFilter,
  type BookingListStatusFilter,
  type DeleteQuizSessionForVisitorResult,
  type PaginatedVisitorQuizSessionsResult,
  type QuizAuditAdminRow,
  type QuizSessionDetail,
  type QuizSessionLinkedBooking,
  type QuizSessionListRow,
  type UpsertQuizProgressInput,
  type UpsertQuizProgressResult,
  type VisitorQuizSessionListStatusFilter,
  type VisitorQuizSessionSummary,
} from '@/lib/data/quiz-session-types';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { releaseSlotReservationsForQuizSession } from '@/lib/payments/release-quiz-session-slot-reservations';

export type {
  BookingListStatusFilter,
  DeleteQuizSessionForVisitorResult,
  PaginatedVisitorQuizSessionsResult,
  QuizAuditAdminRow,
  QuizSessionDetail,
  QuizSessionLinkedBooking,
  QuizSessionListRow,
  UpsertQuizProgressInput,
  UpsertQuizProgressResult,
  VisitorQuizSessionListStatusFilter,
  VisitorQuizSessionSummary,
} from '@/lib/data/quiz-session-types';
export {
  normalizeBookingListStatusFilter,
  normalizeVisitorQuizSessionListStatusFilter,
} from '@/lib/data/quiz-session-types';
export { buildAccountDiagnosticsBookingStatusMatch } from '@/lib/marketing/account-booking-status';

const DEFAULT_QUIZ_SESSION_LIST_LIMIT = 500;
const DEFAULT_QUIZ_AUDIT_LIST_LIMIT = 200;
const DEFAULT_VISITOR_SESSION_LIST_LIMIT = 50;
const BLANK_QUIZ_ANSWERS: QuizAnswers = {
  guidedDiagnostic: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
  situation: '',
  situationAdvisorSummary: '',
  situationDiagnosticThread: buildDiagnosticThreadJson(GUIDED_DIAGNOSTIC_EMPTY),
};

function readSituationAnswer(answers: QuizAnswers): string | null {
  const raw = answers.situation;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const displayPreview = resolveQuizSessionDisplayPreview({
    guidedDiagnosticRaw: guidedRaw,
    situationAnswer: readSituationAnswer(doc.answers),
  });
  return {
    id: doc._id.toString(),
    visitorId: doc.visitorId,
    currentStep: doc.currentStep,
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
    hasGuidedDiagnostic: guidedRaw !== null,
    sessionTitlePreview: displayPreview.sessionTitlePreview,
    situationPreview: displayPreview.situationPreview,
    situationLabel: displayPreview.situationLabel,
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
  readonly guidedDiagnosticSnapshot: string | null;
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
      {
        projection: {
          _id: 1,
          quizSessionId: 1,
          status: 1,
          startsAt: 1,
          timezone: 1,
          serviceKey: 1,
          meetingUrl: 1,
          guidedDiagnosticSnapshot: 1,
          updatedAt: 1,
        },
      },
    )
    .toArray();
  const bookingsBySessionKey = new Map<string, BookingDocument[]>();
  for (const doc of docs) {
    if (doc._id === undefined || doc.quizSessionId === undefined || doc.quizSessionId === null) {
      continue;
    }
    const sessionKey = doc.quizSessionId.toString();
    const existing = bookingsBySessionKey.get(sessionKey);
    if (existing === undefined) {
      bookingsBySessionKey.set(sessionKey, [doc]);
      continue;
    }
    existing.push(doc);
  }
  for (const [sessionKey, sessionBookings] of bookingsBySessionKey) {
    const primary = pickPrimaryBookingForQuizSession(sessionBookings);
    if (primary === null || primary._id === undefined) {
      continue;
    }
    const normalizedStatus = normalizeBookingDocumentStatus(primary.status);
    if (normalizedStatus === null) {
      continue;
    }
    const meetingRaw = primary.meetingUrl;
    const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
    const snapshotRaw = primary.guidedDiagnosticSnapshot;
    const guidedDiagnosticSnapshot =
      typeof snapshotRaw === 'string' && snapshotRaw.trim().length > 0 ? snapshotRaw.trim() : null;
    result.set(sessionKey, {
      bookingId: primary._id.toString(),
      bookingStatus: normalizedStatus,
      bookingStartsAtIso: primary.startsAt.toISOString(),
      bookingTimezone: primary.timezone,
      bookingServiceKey: primary.serviceKey,
      bookingMeetingUrl: meetingUrl,
      guidedDiagnosticSnapshot,
    });
  }
  return result;
}

function mapBookingDocumentToLinkedSummary(doc: BookingDocument & { _id: ObjectId }): LinkedBookingSummary | null {
  const normalizedStatus = normalizeBookingDocumentStatus(doc.status);
  if (normalizedStatus === null || doc.startsAt === undefined) {
    return null;
  }
  const meetingRaw = doc.meetingUrl;
  const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
  const snapshotRaw = doc.guidedDiagnosticSnapshot;
  const guidedDiagnosticSnapshot =
    typeof snapshotRaw === 'string' && snapshotRaw.trim().length > 0 ? snapshotRaw.trim() : null;
  return {
    bookingId: doc._id.toString(),
    bookingStatus: normalizedStatus,
    bookingStartsAtIso: doc.startsAt.toISOString(),
    bookingTimezone: doc.timezone,
    bookingServiceKey: doc.serviceKey,
    bookingMeetingUrl: meetingUrl,
    guidedDiagnosticSnapshot,
  };
}

async function fetchLinkedBookingSummariesByBookingIds(
  bookingIds: readonly string[],
): Promise<Map<string, LinkedBookingSummary>> {
  const result = new Map<string, LinkedBookingSummary>();
  const uniqueIds = [...new Set(bookingIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (uniqueIds.length === 0 || !hasMongoUri()) {
    return result;
  }
  const objectIds: ObjectId[] = [];
  for (const id of uniqueIds) {
    try {
      objectIds.push(new ObjectId(id));
    } catch {
      /* Skip invalid booking ids. */
    }
  }
  if (objectIds.length === 0) {
    return result;
  }
  const db = await getDb();
  const docs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find(
      { _id: { $in: objectIds } },
      {
        projection: {
          _id: 1,
          status: 1,
          startsAt: 1,
          timezone: 1,
          serviceKey: 1,
          meetingUrl: 1,
          guidedDiagnosticSnapshot: 1,
        },
      },
    )
    .toArray();
  for (const doc of docs) {
    if (doc._id === undefined) {
      continue;
    }
    const summary = mapBookingDocumentToLinkedSummary(doc as BookingDocument & { _id: ObjectId });
    if (summary !== null) {
      result.set(doc._id.toString(), summary);
    }
  }
  return result;
}

function resolveLinkedBookingForSession(
  sessionHex: string,
  bookingBySessionId: Map<string, LinkedBookingSummary>,
  paymentBySessionId: Map<string, { readonly bookingId: string | null }>,
  bookingById: Map<string, LinkedBookingSummary>,
): LinkedBookingSummary | null {
  const linkedBySession = bookingBySessionId.get(sessionHex);
  if (linkedBySession !== undefined) {
    return linkedBySession;
  }
  const paymentBookingId = paymentBySessionId.get(sessionHex)?.bookingId?.trim() ?? '';
  if (paymentBookingId.length === 0) {
    return null;
  }
  return bookingById.get(paymentBookingId) ?? null;
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
      const fathomRaw = b.fathomShareUrl;
      const fathomShareUrl =
        typeof fathomRaw === 'string' && fathomRaw.trim().length > 0 ? fathomRaw.trim() : null;
      return {
        id: b._id.toString(),
        startsAtIso: b.startsAt.toISOString(),
        timezone: b.timezone,
        serviceKey: b.serviceKey,
        meetingUrl,
        status: b.status,
        recordingOptIn: b.recordingOptIn === true,
        fathomShareUrl,
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
 * Session to attach at booking time: prefers `visitor_sessions.latestSessionId` (matches `/diagnostic/[sessionRef]` saves)
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

type LinkedPaymentSummary = {
  readonly paymentTransactionId: string;
  readonly paymentTransactionStatus: PaymentStatus;
  readonly checkoutStartsAtIso: string;
  readonly checkoutTimezone: string;
  readonly checkoutServiceKey: string;
};

function mapVisitorQuizSessionSummary(
  doc: QuizSessionDocument & { _id: ObjectId },
  linkedBooking: LinkedBookingSummary | null,
  linkedPayment: LinkedPaymentSummary | null,
): VisitorQuizSessionSummary {
  const guidedRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
  const situationAnswer = readSituationAnswer(doc.answers);
  const bookingSnapshot = linkedBooking?.guidedDiagnosticSnapshot ?? null;
  const displayPreview = resolveQuizSessionSummaryDisplayPreview({
    guidedDiagnosticRaw: guidedRaw,
    situationAnswer,
    bookingGuidedDiagnosticSnapshot: bookingSnapshot,
  });
  const idHex = doc._id.toString();
  const bookingId = linkedBooking?.bookingId ?? null;
  const completedAtIso = doc.completedAt !== undefined ? doc.completedAt.toISOString() : null;
  const isDiagnosticComplete =
    resolveQuizSessionDiagnosticCompleted({
      completedAtIso,
      guidedDiagnosticRaw: guidedRaw,
    }) ||
    resolveQuizSessionDiagnosticCompleted({
      completedAtIso,
      guidedDiagnosticRaw: bookingSnapshot,
    });
  return {
    id: idHex,
    marketingSessionRef: encodeQuizSessionRefForMarketingUrl(idHex),
    currentStep: doc.currentStep,
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso,
    isDiagnosticComplete,
    sessionTitlePreview: displayPreview.sessionTitlePreview,
    situationPreview: displayPreview.situationPreview,
    situationLabel: displayPreview.situationLabel,
    hasGuidedDiagnostic: guidedRaw !== null,
    isBooked: bookingId !== null,
    bookingId,
    bookingReferenceId: bookingId !== null ? formatBookingReferenceId(bookingId) : null,
    bookingStatus: normalizeBookingDocumentStatus(linkedBooking?.bookingStatus),
    bookingStartsAtIso: linkedBooking?.bookingStartsAtIso ?? linkedPayment?.checkoutStartsAtIso ?? null,
    bookingTimezone: linkedBooking?.bookingTimezone ?? linkedPayment?.checkoutTimezone ?? null,
    bookingServiceKey: linkedBooking?.bookingServiceKey ?? linkedPayment?.checkoutServiceKey ?? null,
    bookingMeetingUrl: linkedBooking?.bookingMeetingUrl ?? null,
    paymentTransactionId: linkedPayment?.paymentTransactionId ?? null,
    paymentTransactionStatus: linkedPayment?.paymentTransactionStatus ?? null,
    checkoutStartsAtIso: linkedPayment?.checkoutStartsAtIso ?? null,
    checkoutTimezone: linkedPayment?.checkoutTimezone ?? null,
    checkoutServiceKey: linkedPayment?.checkoutServiceKey ?? null,
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
  const sessionIdHexes = sessionIds.map((id) => id.toString());
  const bookingBySessionId = await fetchPrimaryBookingByQuizSessionIds(sessionIds);
  const paymentBySessionId = await fetchLatestPaymentTransactionsByQuizSessionIds(sessionIdHexes);
  const fallbackBookingIds = sessionIdHexes
    .filter((sessionHex) => !bookingBySessionId.has(sessionHex))
    .map((sessionHex) => paymentBySessionId.get(sessionHex)?.bookingId ?? null)
    .filter((bookingId): bookingId is string => bookingId !== null && bookingId.trim().length > 0);
  const bookingById = await fetchLinkedBookingSummariesByBookingIds(fallbackBookingIds);
  return validDocs.map((doc) => {
    const sessionHex = doc._id.toString();
    const paymentRow = paymentBySessionId.get(sessionHex);
    const linkedPayment =
      paymentRow !== undefined
        ? {
            paymentTransactionId: paymentRow.id,
            paymentTransactionStatus: paymentRow.status,
            checkoutStartsAtIso: paymentRow.startsAtIso,
            checkoutTimezone: paymentRow.timezone,
            checkoutServiceKey: paymentRow.serviceKey,
          }
        : null;
    const linkedBooking = resolveLinkedBookingForSession(
      sessionHex,
      bookingBySessionId,
      paymentBySessionId,
      bookingById,
    );
    return mapVisitorQuizSessionSummary(doc, linkedBooking, linkedPayment);
  });
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
    guidedDiagnosticSnapshot?: string | null;
  } | null;
};

/**
 * Backfills `completedAt` for guided sessions that finished but never sent `completed: true`.
 */
export async function syncVisitorQuizDiagnosticCompletion(visitorId: string): Promise<number> {
  if (!hasMongoUri()) {
    return 0;
  }
  const db = await getDb();
  const docs = await db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .find({
      visitorId,
      completedAt: { $exists: false },
    })
    .limit(100)
    .toArray();
  let count = 0;
  const now = new Date();
  for (const doc of docs) {
    if (doc._id === undefined) {
      continue;
    }
    const guidedRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
    const completedAtIso = doc.completedAt !== undefined ? doc.completedAt.toISOString() : null;
    if (
      !resolveQuizSessionDiagnosticCompleted({
        completedAtIso,
        guidedDiagnosticRaw: guidedRaw,
      })
    ) {
      continue;
    }
    await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).updateOne(
      { _id: doc._id },
      { $set: { completedAt: doc.updatedAt ?? now, updatedAt: now } },
    );
    count += 1;
  }
  return count;
}

/**
 * Paginated account diagnostics list with server-side status and booking-reference filters.
 */
export async function listQuizSessionsForVisitorPaginated(input: {
  readonly visitorId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status: BookingListStatusFilter;
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
  const { cancelExpiredPaymentWindowBookings } = await import(
    '@/lib/payments/cancel-expired-payment-window-bookings'
  );
  await Promise.all([
    syncVisitorQuizDiagnosticCompletion(input.visitorId),
    cancelExpiredPaymentWindowBookings({ visitorId: input.visitorId }),
  ]);
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
          {
            $project: {
              _id: 1,
              status: 1,
              startsAt: 1,
              timezone: 1,
              serviceKey: 1,
              meetingUrl: 1,
              guidedDiagnosticSnapshot: 1,
              updatedAt: 1,
              statusRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$status', 'completed'] }, then: 4 },
                    { case: { $eq: ['$status', 'confirmed'] }, then: 3 },
                    { case: { $eq: ['$status', 'pending'] }, then: 2 },
                    { case: { $eq: ['$status', 'cancelled'] }, then: 1 },
                  ],
                  default: 0,
                },
              },
            },
          },
        ],
        as: 'linkedBookings',
      },
    },
    {
      $addFields: {
        linkedBooking: {
          $let: {
            vars: {
              sortedBookings: {
                $sortArray: {
                  input: '$linkedBookings',
                  sortBy: { statusRank: -1, updatedAt: -1 },
                },
              },
            },
            in: { $arrayElemAt: ['$$sortedBookings', 0] },
          },
        },
      },
    },
    {
      $lookup: {
        from: COLLECTIONS.paymentTransactions,
        let: { sessionHex: { $toString: '$_id' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$quizSessionIdHex', '$$sessionHex'] } } },
          { $sort: { updatedAt: -1 } },
          { $limit: 1 },
          { $project: { status: 1 } },
        ],
        as: 'latestPayments',
      },
    },
    {
      $addFields: {
        latestPaymentStatus: {
          $ifNull: [{ $arrayElemAt: ['$latestPayments.status', 0] }, null],
        },
      },
    },
  ];
  const statusMatch = buildAccountDiagnosticsBookingStatusMatch(input.status);
  if (Object.keys(statusMatch).length > 0) {
    pipeline.push({ $match: statusMatch });
  }
  const bookingReference = input.bookingReference?.trim() ?? '';
  if (bookingReference.length > 0) {
    const escapedReference = bookingReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pipeline.push({
      $match: {
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: '$linkedBookings',
                  as: 'booking',
                  cond: {
                    $regexMatch: {
                      input: { $toString: '$$booking._id' },
                      regex: escapedReference,
                      options: 'i',
                    },
                  },
                },
              },
            },
            0,
          ],
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
  const paymentBySessionId = await fetchLatestPaymentTransactionsByQuizSessionIds(
    rows.map((row) => row._id.toString()),
  );
  const fallbackBookingIds = rows
    .filter((row) => row.linkedBooking === null || row.linkedBooking === undefined)
    .map((row) => paymentBySessionId.get(row._id.toString())?.bookingId ?? null)
    .filter((bookingId): bookingId is string => bookingId !== null && bookingId.trim().length > 0);
  const bookingById = await fetchLinkedBookingSummariesByBookingIds(fallbackBookingIds);
  const sessions = rows.map((row) => {
    const linkedBookingFromAggregation =
      row.linkedBooking !== null && row.linkedBooking !== undefined
        ? (() => {
            const meetingRaw = row.linkedBooking.meetingUrl;
            const meetingUrl =
              typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
            const snapshotRaw = row.linkedBooking.guidedDiagnosticSnapshot;
            const guidedDiagnosticSnapshot =
              typeof snapshotRaw === 'string' && snapshotRaw.trim().length > 0 ? snapshotRaw.trim() : null;
            return {
              bookingId: row.linkedBooking._id.toString(),
              bookingStatus: normalizeBookingDocumentStatus(row.linkedBooking.status) ?? row.linkedBooking.status,
              bookingStartsAtIso: row.linkedBooking.startsAt.toISOString(),
              bookingTimezone: row.linkedBooking.timezone,
              bookingServiceKey: row.linkedBooking.serviceKey,
              bookingMeetingUrl: meetingUrl,
              guidedDiagnosticSnapshot,
            };
          })()
        : null;
    const sessionHex = row._id.toString();
    const paymentRow = paymentBySessionId.get(sessionHex);
    const linkedPayment =
      paymentRow !== undefined
        ? {
            paymentTransactionId: paymentRow.id,
            paymentTransactionStatus: paymentRow.status,
            checkoutStartsAtIso: paymentRow.startsAtIso,
            checkoutTimezone: paymentRow.timezone,
            checkoutServiceKey: paymentRow.serviceKey,
          }
        : null;
    const linkedBooking =
      linkedBookingFromAggregation ??
      resolveLinkedBookingForSession(sessionHex, new Map(), paymentBySessionId, bookingById);
    return mapVisitorQuizSessionSummary(row, linkedBooking, linkedPayment);
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

/**
 * Removes a quiz session and its audit rows when it belongs to the visitor. Active bookings and checkout holds
 * for the session are cancelled first so the reserved slot is released for other visitors.
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
  await releaseSlotReservationsForQuizSession(objectId);
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateMany(
    { quizSessionId: objectId },
    { $unset: { quizSessionId: '' }, $set: { updatedAt: new Date() } },
  );
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
