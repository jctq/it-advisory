import { ObjectId, type Document } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type {
  BookingDocument,
  DiagnosticAnswers,
  DiagnosticAuditDocument,
  DiagnosticSessionDocument,
  VisitorSessionDocument,
} from '@/domain/types';
import type { PaymentStatus } from '@/domain/payment-types';
import { fetchLatestPaymentTransactionsByDiagnosticSessionIds } from '@/lib/data/payment-transactions';
import { resolveDiagnosticSessionCompleted, isGuidedDiagnosticExplicitReset } from '@teqmd/diagnostic-core/diagnostic-session-complete';
import { resolvePaymentStatusForCustomerLifecycle } from '@/lib/payments/payment-checkout-commit';
import { resolveDiagnosticSessionDisplayPreview } from '@teqmd/diagnostic-core/diagnostic-session-display-preview';
import { resolveDiagnosticSessionSummaryDisplayPreview } from '@/lib/marketing/diagnostic-session-summary-display';
import { extractGuidedDiagnosticRawFromDiagnosticAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { buildDiagnosticThreadJson, GUIDED_DIAGNOSTIC_EMPTY, serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import { getActiveDiagnosticTemplate } from '@/lib/data/diagnostic-templates';
import { getDb } from '@/lib/mongodb';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import {
  normalizeBookingDocumentStatus,
  pickPrimaryBookingForDiagnosticSession,
} from '@/lib/data/pick-primary-booking-for-diagnostic-session';
import { buildAccountDiagnosticsBookingStatusMatch } from '@/lib/marketing/account-booking-status';
import {
  normalizeVisitorDiagnosticSessionListStatusFilter,
  type BookingListStatusFilter,
  type DeleteDiagnosticSessionForVisitorResult,
  type PaginatedVisitorDiagnosticSessionsResult,
  type DiagnosticAuditAdminRow,
  type DiagnosticSessionDetail,
  type DiagnosticSessionLinkedBooking,
  type DiagnosticSessionListRow,
  type UpsertDiagnosticProgressInput,
  type UpsertDiagnosticProgressResult,
  type VisitorDiagnosticSessionListStatusFilter,
  type VisitorDiagnosticSessionSummary,
} from '@/lib/data/diagnostic-session-types';
import { encodeDiagnosticSessionRefForMarketingUrl } from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import { releaseSlotReservationsForDiagnosticSession } from '@/lib/payments/release-diagnostic-session-slot-reservations';

export type {
  BookingListStatusFilter,
  DeleteDiagnosticSessionForVisitorResult,
  PaginatedVisitorDiagnosticSessionsResult,
  DiagnosticAuditAdminRow,
  DiagnosticSessionDetail,
  DiagnosticSessionLinkedBooking,
  DiagnosticSessionListRow,
  UpsertDiagnosticProgressInput,
  UpsertDiagnosticProgressResult,
  VisitorDiagnosticSessionListStatusFilter,
  VisitorDiagnosticSessionSummary,
} from '@/lib/data/diagnostic-session-types';
export {
  normalizeBookingListStatusFilter,
  normalizeVisitorDiagnosticSessionListStatusFilter,
} from '@/lib/data/diagnostic-session-types';
export { buildAccountDiagnosticsBookingStatusMatch } from '@/lib/marketing/account-booking-status';

const DEFAULT_DIAGNOSTIC_SESSION_LIST_LIMIT = 500;
const DEFAULT_DIAGNOSTIC_AUDIT_LIST_LIMIT = 200;
const DEFAULT_VISITOR_SESSION_LIST_LIMIT = 50;
const BLANK_DIAGNOSTIC_ANSWERS: DiagnosticAnswers = {
  guidedDiagnostic: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
  situation: '',
  situationAdvisorSummary: '',
  situationDiagnosticThread: buildDiagnosticThreadJson(GUIDED_DIAGNOSTIC_EMPTY),
};

function readSituationAnswer(answers: DiagnosticAnswers): string | null {
  const raw = answers.situation;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveSituationDiagnosticThread(answers: DiagnosticAnswers): string | null {
  const raw = answers.situationDiagnosticThread;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapDiagnosticSessionListRow(
  doc: DiagnosticSessionDocument & { _id: ObjectId },
  bookingId: string | null,
): DiagnosticSessionListRow {
  const guidedRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(doc.answers);
  const displayPreview = resolveDiagnosticSessionDisplayPreview({
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
  readonly bookingPaymentStatus: PaymentStatus | null;
  readonly bookingStartsAtIso: string;
  readonly bookingTimezone: string;
  readonly bookingServiceKey: string;
  readonly bookingMeetingUrl: string | null;
  readonly guidedDiagnosticSnapshot: string | null;
};

async function fetchPrimaryBookingIdByDiagnosticSessionIds(sessionIds: readonly ObjectId[]): Promise<Map<string, string>> {
  const linked = await fetchPrimaryBookingByDiagnosticSessionIds(sessionIds);
  const result = new Map<string, string>();
  for (const [sessionKey, booking] of linked) {
    result.set(sessionKey, booking.bookingId);
  }
  return result;
}

async function fetchPrimaryBookingByDiagnosticSessionIds(
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
      { diagnosticSessionId: { $in: [...sessionIds] } },
      {
        projection: {
          _id: 1,
          diagnosticSessionId: 1,
          status: 1,
          paymentStatus: 1,
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
    if (doc._id === undefined || doc.diagnosticSessionId === undefined || doc.diagnosticSessionId === null) {
      continue;
    }
    const sessionKey = doc.diagnosticSessionId.toString();
    const existing = bookingsBySessionKey.get(sessionKey);
    if (existing === undefined) {
      bookingsBySessionKey.set(sessionKey, [doc]);
      continue;
    }
    existing.push(doc);
  }
  for (const [sessionKey, sessionBookings] of bookingsBySessionKey) {
    const primary = pickPrimaryBookingForDiagnosticSession(sessionBookings);
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
      bookingPaymentStatus: primary.paymentStatus ?? null,
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
    bookingPaymentStatus: doc.paymentStatus ?? null,
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
          paymentStatus: 1,
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
 * Admin list: all persisted diagnostic session snapshots (latest row per visitor when upserts target the same document).
 */
export async function listDiagnosticSessionsForAdmin(
  limit: number = DEFAULT_DIAGNOSTIC_SESSION_LIST_LIMIT,
): Promise<DiagnosticSessionListRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions)
    .find()
    .sort({ updatedAt: -1 })
    .limit(limit);
  const docs = await cursor.toArray();
  const validDocs = docs.filter((doc): doc is DiagnosticSessionDocument & { _id: ObjectId } => doc._id !== undefined);
  const sessionIds = validDocs.map((doc) => doc._id);
  const bookingIdBySessionId = await fetchPrimaryBookingIdByDiagnosticSessionIds(sessionIds);
  return validDocs.map((doc) =>
    mapDiagnosticSessionListRow(doc, bookingIdBySessionId.get(doc._id.toString()) ?? null),
  );
}

/**
 * Admin detail: one diagnostic session by Mongo `_id`.
 */
export async function findDiagnosticSessionById(sessionId: string): Promise<DiagnosticSessionDetail | null> {
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
  const doc = await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).findOne({ _id: objectId });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  const guidedDiagnosticRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(doc.answers);
  const linkedBookingDocs = await db
    .collection<BookingDocument>(COLLECTIONS.bookings)
    .find({ diagnosticSessionId: objectId })
    .sort({ startsAt: -1 })
    .toArray();
  const linkedBookings: DiagnosticSessionLinkedBooking[] = linkedBookingDocs
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
 * Append-only save history for a session (`diagnostic_audit`).
 */
export async function listDiagnosticAuditForSession(
  sessionId: ObjectId,
  limit: number = DEFAULT_DIAGNOSTIC_AUDIT_LIST_LIMIT,
): Promise<DiagnosticAuditAdminRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<DiagnosticAuditDocument>(COLLECTIONS.diagnosticAudit)
    .find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs
    .filter((doc): doc is DiagnosticAuditDocument & { _id: ObjectId } => doc._id !== undefined)
    .map((doc) => ({
      id: doc._id.toString(),
      step: doc.step,
      createdAtIso: doc.createdAt.toISOString(),
      answersJson: safeStringifyAnswers(doc.answersSnapshot),
    }));
}

function safeStringifyAnswers(answers: DiagnosticAnswers): string {
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

export async function findIncompleteDiagnosticSession(visitorId: string): Promise<DiagnosticSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions)
    .findOne({ visitorId, completedAt: { $exists: false } }, { sort: { updatedAt: -1 } });
  return doc;
}

/**
 * Latest diagnostic session row for this visitor (complete or not). Used to restore guided diagnostic answers after finishing.
 */
export async function findLatestDiagnosticSession(visitorId: string): Promise<DiagnosticSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions)
    .findOne({ visitorId }, { sort: { updatedAt: -1 } });
}

/**
 * Session to attach at booking time: prefers `visitor_sessions.latestSessionId` (matches `/diagnostic/[sessionRef]` saves)
 * over a raw `updatedAt` sort, which can pick a different row if multiple sessions exist.
 */
export async function findDiagnosticSessionForBookingSnapshot(visitorId: string): Promise<DiagnosticSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const pointer = await db
    .collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions)
    .findOne({ visitorId });
  if (pointer?.latestSessionId !== undefined && pointer.latestSessionId !== null) {
    const preferred = await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).findOne({
      _id: pointer.latestSessionId,
      visitorId,
    });
    if (preferred !== null) {
      return preferred;
    }
  }
  return findLatestDiagnosticSession(visitorId);
}

type LinkedPaymentSummary = {
  readonly paymentTransactionId: string;
  readonly paymentTransactionStatus: PaymentStatus;
  readonly checkoutStartsAtIso: string;
  readonly checkoutTimezone: string;
  readonly checkoutServiceKey: string;
  readonly metadata?: Record<string, string>;
};

function mapVisitorDiagnosticSessionSummary(
  doc: DiagnosticSessionDocument & { _id: ObjectId },
  linkedBooking: LinkedBookingSummary | null,
  linkedPayment: LinkedPaymentSummary | null,
): VisitorDiagnosticSessionSummary {
  const guidedRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(doc.answers);
  const situationAnswer = readSituationAnswer(doc.answers);
  const bookingSnapshot = linkedBooking?.guidedDiagnosticSnapshot ?? null;
  const displayPreview = resolveDiagnosticSessionSummaryDisplayPreview({
    guidedDiagnosticRaw: guidedRaw,
    situationAnswer,
    bookingGuidedDiagnosticSnapshot: bookingSnapshot,
  });
  const idHex = doc._id.toString();
  const bookingId = linkedBooking?.bookingId ?? null;
  const completedAtIso = doc.completedAt !== undefined ? doc.completedAt.toISOString() : null;
  const isDiagnosticComplete =
    resolveDiagnosticSessionCompleted({
      completedAtIso,
      guidedDiagnosticRaw: guidedRaw,
    }) ||
    resolveDiagnosticSessionCompleted({
      completedAtIso,
      guidedDiagnosticRaw: bookingSnapshot,
    });
  return {
    id: idHex,
    marketingSessionRef: encodeDiagnosticSessionRefForMarketingUrl(idHex),
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
    bookingPaymentStatus: linkedBooking?.bookingPaymentStatus ?? null,
    bookingStartsAtIso: linkedBooking?.bookingStartsAtIso ?? linkedPayment?.checkoutStartsAtIso ?? null,
    bookingTimezone: linkedBooking?.bookingTimezone ?? linkedPayment?.checkoutTimezone ?? null,
    bookingServiceKey: linkedBooking?.bookingServiceKey ?? linkedPayment?.checkoutServiceKey ?? null,
    bookingMeetingUrl: linkedBooking?.bookingMeetingUrl ?? null,
    paymentTransactionId: linkedPayment?.paymentTransactionId ?? null,
    paymentTransactionStatus: resolvePaymentStatusForCustomerLifecycle(
      linkedPayment?.paymentTransactionStatus ?? null,
      linkedPayment?.metadata,
    ),
    checkoutStartsAtIso: linkedPayment?.checkoutStartsAtIso ?? null,
    checkoutTimezone: linkedPayment?.checkoutTimezone ?? null,
    checkoutServiceKey: linkedPayment?.checkoutServiceKey ?? null,
  };
}

/**
 * Lists persisted diagnostic session rows for a visitor id (e.g. `acct:<userId>` or anonymous cookie id), newest first.
 */
export async function listDiagnosticSessionsForVisitor(
  visitorId: string,
  limit: number = DEFAULT_VISITOR_SESSION_LIST_LIMIT,
): Promise<VisitorDiagnosticSessionSummary[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions)
    .find({ visitorId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  const validDocs = docs.filter((doc): doc is DiagnosticSessionDocument & { _id: ObjectId } => doc._id !== undefined);
  const sessionIds = validDocs.map((doc) => doc._id);
  const sessionIdHexes = sessionIds.map((id) => id.toString());
  const bookingBySessionId = await fetchPrimaryBookingByDiagnosticSessionIds(sessionIds);
  const paymentBySessionId = await fetchLatestPaymentTransactionsByDiagnosticSessionIds(sessionIdHexes);
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
            metadata: paymentRow.metadata,
          }
        : null;
    const linkedBooking = resolveLinkedBookingForSession(
      sessionHex,
      bookingBySessionId,
      paymentBySessionId,
      bookingById,
    );
    return mapVisitorDiagnosticSessionSummary(doc, linkedBooking, linkedPayment);
  });
}

type AggregatedVisitorDiagnosticSessionRow = DiagnosticSessionDocument & {
  _id: ObjectId;
  linkedBooking: {
    _id: ObjectId;
    status: BookingDocument['status'];
    paymentStatus?: PaymentStatus | null;
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
export async function syncVisitorDiagnosticCompletion(visitorId: string): Promise<number> {
  if (!hasMongoUri()) {
    return 0;
  }
  const db = await getDb();
  const docs = await db
    .collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions)
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
    const guidedRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(doc.answers);
    const completedAtIso = doc.completedAt !== undefined ? doc.completedAt.toISOString() : null;
    if (
      !resolveDiagnosticSessionCompleted({
        completedAtIso,
        guidedDiagnosticRaw: guidedRaw,
      })
    ) {
      continue;
    }
    await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).updateOne(
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
export async function listDiagnosticSessionsForVisitorPaginated(input: {
  readonly visitorId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status: BookingListStatusFilter;
  readonly bookingReference?: string;
}): Promise<PaginatedVisitorDiagnosticSessionsResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(50, Math.max(1, input.pageSize));
  const emptyResult: PaginatedVisitorDiagnosticSessionsResult = {
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
    syncVisitorDiagnosticCompletion(input.visitorId),
    cancelExpiredPaymentWindowBookings({ visitorId: input.visitorId }),
  ]);
  const db = await getDb();
  const hasAnySessions =
    (await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).countDocuments(
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
          { $match: { $expr: { $eq: ['$diagnosticSessionId', '$$sessionId'] } } },
          {
            $project: {
              _id: 1,
              status: 1,
              paymentStatus: 1,
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
          { $match: { $expr: { $eq: ['$diagnosticSessionIdHex', '$$sessionHex'] } } },
          { $sort: { updatedAt: -1 } },
          { $limit: 1 },
          { $project: { status: 1, 'metadata.checkoutCommitted': 1 } },
        ],
        as: 'latestPayments',
      },
    },
    {
      $addFields: {
        latestPaymentStatus: {
          $ifNull: [{ $arrayElemAt: ['$latestPayments.status', 0] }, null],
        },
        latestPaymentCheckoutCommitted: {
          $ifNull: [{ $arrayElemAt: ['$latestPayments.metadata.checkoutCommitted', 0] }, null],
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
  const facetRows = await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).aggregate(pipeline).toArray();
  const facetResult = facetRows[0] as { total?: { count: number }[]; rows?: AggregatedVisitorDiagnosticSessionRow[] } | undefined;
  const totalCount = facetResult?.total?.[0]?.count ?? 0;
  const rows = facetResult?.rows ?? [];
  const paymentBySessionId = await fetchLatestPaymentTransactionsByDiagnosticSessionIds(
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
              bookingPaymentStatus: row.linkedBooking.paymentStatus ?? null,
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
            metadata: paymentRow.metadata,
          }
        : null;
    const linkedBooking =
      linkedBookingFromAggregation ??
      resolveLinkedBookingForSession(sessionHex, new Map(), paymentBySessionId, bookingById);
    return mapVisitorDiagnosticSessionSummary(row, linkedBooking, linkedPayment);
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
 * Loads one diagnostic session when it belongs to the given visitor id.
 */
export async function findDiagnosticSessionForVisitor(
  visitorId: string,
  sessionId: string,
): Promise<DiagnosticSessionDocument | null> {
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
  return db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).findOne({
    _id: objectId,
    visitorId,
  });
}

/**
 * Removes a diagnostic session and its audit rows when it belongs to the visitor. Active bookings and checkout holds
 * for the session are cancelled first so the reserved slot is released for other visitors.
 */
export async function deleteDiagnosticSessionForVisitor(visitorId: string, sessionId: string): Promise<DeleteDiagnosticSessionForVisitorResult> {
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
  const sessions = db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions);
  const existing = await sessions.findOne({ _id: objectId, visitorId });
  if (existing === null) {
    return { ok: false, code: 'not_found' };
  }
  await releaseSlotReservationsForDiagnosticSession(objectId);
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateMany(
    { diagnosticSessionId: objectId },
    { $unset: { diagnosticSessionId: '' }, $set: { updatedAt: new Date() } },
  );
  await db.collection<DiagnosticAuditDocument>(COLLECTIONS.diagnosticAudit).deleteMany({ sessionId: objectId });
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
 * Inserts a new empty diagnostic session for this visitor and points `visitor_sessions` at it.
 */
export async function insertBlankDiagnosticSessionForVisitor(visitorId: string): Promise<string | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const sessions = db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions);
  const now = new Date();
  const templateObjectId = await resolveActiveDiagnosticTemplateObjectId();
  const insertDoc: Omit<DiagnosticSessionDocument, '_id'> = {
    visitorId,
    answers: BLANK_DIAGNOSTIC_ANSWERS,
    currentStep: 0,
    createdAt: now,
    updatedAt: now,
    ...(templateObjectId !== null ? { diagnosticTemplateId: templateObjectId } : {}),
  };
  const insertResult = await sessions.insertOne(insertDoc);
  await insertDiagnosticAudit({
    visitorId,
    sessionId: insertResult.insertedId,
    step: 0,
    answersSnapshot: BLANK_DIAGNOSTIC_ANSWERS,
  });
  await upsertVisitorSessionPointer(visitorId, insertResult.insertedId);
  return insertResult.insertedId.toString();
}

async function insertDiagnosticAudit(input: {
  readonly visitorId: string;
  readonly sessionId: ObjectId;
  readonly step: number;
  readonly answersSnapshot: DiagnosticAnswers;
}): Promise<void> {
  const db = await getDb();
  const auditDoc: DiagnosticAuditDocument = {
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    step: input.step,
    answersSnapshot: input.answersSnapshot,
    createdAt: new Date(),
  };
  await db.collection<DiagnosticAuditDocument>(COLLECTIONS.diagnosticAudit).insertOne(auditDoc);
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
 * Creates or updates the visitor's in-progress diagnostic session and writes an audit row.
 */
export async function upsertDiagnosticProgress(input: UpsertDiagnosticProgressInput): Promise<UpsertDiagnosticProgressResult> {
  if (!hasMongoUri()) {
    return { persisted: false };
  }
  const db = await getDb();
  const sessions = db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions);
  const now = new Date();
  const incomingGuidedRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(input.answers);
  const derivedComplete = resolveDiagnosticSessionCompleted({
    completedAtIso: null,
    guidedDiagnosticRaw: incomingGuidedRaw,
  });
  const isExplicitReset = isGuidedDiagnosticExplicitReset(incomingGuidedRaw);
  const effectiveIsComplete = input.isComplete || derivedComplete;
  const setFields: Record<string, unknown> = {
    answers: input.answers,
    currentStep: input.currentStep,
    updatedAt: now,
  };
  if (effectiveIsComplete) {
    setFields.completedAt = now;
  }
  let target: (DiagnosticSessionDocument & { _id: ObjectId }) | null = null;
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
    target = found as DiagnosticSessionDocument & { _id: ObjectId };
  } else {
    const latest = await sessions.findOne({ visitorId: input.visitorId }, { sort: { updatedAt: -1 } });
    if (latest !== null && latest._id !== undefined) {
      target = latest as DiagnosticSessionDocument & { _id: ObjectId };
    }
  }
  if (target !== null) {
    const existingGuidedRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(target.answers);
    const existingCompletedAtIso =
      target.completedAt !== undefined ? target.completedAt.toISOString() : null;
    const existingComplete = resolveDiagnosticSessionCompleted({
      completedAtIso: existingCompletedAtIso,
      guidedDiagnosticRaw: existingGuidedRaw,
    });
    if (!effectiveIsComplete && !isExplicitReset && existingComplete) {
      return { persisted: true, sessionId: target._id.toString() };
    }
    const templatePinToSet =
      target.diagnosticTemplateId !== undefined && target.diagnosticTemplateId !== null
        ? null
        : await resolveActiveDiagnosticTemplateObjectId();
    const setWithTemplatePin: Record<string, unknown> = {
      ...setFields,
      ...(templatePinToSet !== null ? { diagnosticTemplateId: templatePinToSet } : {}),
    };
    if (effectiveIsComplete || isExplicitReset) {
      const updateDoc: Record<string, unknown> = { $set: setWithTemplatePin };
      if (isExplicitReset && !effectiveIsComplete) {
        updateDoc.$unset = { completedAt: '' };
      }
      await sessions.updateOne({ _id: target._id }, updateDoc);
    } else {
      await sessions.updateOne({ _id: target._id }, { $set: setWithTemplatePin });
    }
    const shouldWriteAudit =
      target.currentStep !== input.currentStep || effectiveIsComplete || isExplicitReset;
    if (shouldWriteAudit) {
      await insertDiagnosticAudit({
        visitorId: input.visitorId,
        sessionId: target._id,
        step: input.currentStep,
        answersSnapshot: input.answers,
      });
    }
    await upsertVisitorSessionPointer(input.visitorId, target._id);
    return { persisted: true, sessionId: target._id.toString() };
  }
  const insertTemplateId = await resolveActiveDiagnosticTemplateObjectId();
  const insertDoc: Omit<DiagnosticSessionDocument, '_id'> = {
    visitorId: input.visitorId,
    answers: input.answers,
    currentStep: input.currentStep,
    createdAt: now,
    updatedAt: now,
    ...(effectiveIsComplete ? { completedAt: now } : {}),
    ...(insertTemplateId !== null ? { diagnosticTemplateId: insertTemplateId } : {}),
  };
  const insertResult = await sessions.insertOne(insertDoc);
  await insertDiagnosticAudit({
    visitorId: input.visitorId,
    sessionId: insertResult.insertedId,
    step: input.currentStep,
    answersSnapshot: input.answers,
  });
  await upsertVisitorSessionPointer(input.visitorId, insertResult.insertedId);
  return { persisted: true, sessionId: insertResult.insertedId.toString() };
}

/**
 * Marks a session complete when its guided answers (or booking snapshot) show a finished outcome.
 */
export async function markDiagnosticSessionCompleteIfGuided(input: {
  readonly sessionId: ObjectId;
  readonly guidedDiagnosticRaw: string | null;
}): Promise<void> {
  if (!hasMongoUri()) {
    return;
  }
  if (
    !resolveDiagnosticSessionCompleted({
      completedAtIso: null,
      guidedDiagnosticRaw: input.guidedDiagnosticRaw,
    })
  ) {
    return;
  }
  const db = await getDb();
  const now = new Date();
  await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).updateOne(
    { _id: input.sessionId, completedAt: { $exists: false } },
    { $set: { completedAt: now, updatedAt: now } },
  );
}

/**
 * Restores session answers from a booking snapshot when the live session row was corrupted after booking.
 */
export async function repairDiagnosticSessionAnswersFromBookingSnapshot(input: {
  readonly sessionId: ObjectId;
  readonly visitorId: string;
  readonly sessionAnswers: DiagnosticAnswers;
  readonly bookingSnapshotRaw: string | null;
}): Promise<DiagnosticAnswers> {
  const sessionGuidedRaw = extractGuidedDiagnosticRawFromDiagnosticAnswers(input.sessionAnswers);
  const sessionComplete = resolveDiagnosticSessionCompleted({
    completedAtIso: null,
    guidedDiagnosticRaw: sessionGuidedRaw,
  });
  const snapshotRaw = input.bookingSnapshotRaw?.trim() ?? '';
  if (sessionComplete || snapshotRaw.length === 0) {
    return input.sessionAnswers;
  }
  const snapshotComplete = resolveDiagnosticSessionCompleted({
    completedAtIso: null,
    guidedDiagnosticRaw: snapshotRaw,
  });
  if (!snapshotComplete) {
    return input.sessionAnswers;
  }
  const repairedAnswers: DiagnosticAnswers = {
    ...input.sessionAnswers,
    guidedDiagnostic: snapshotRaw,
  };
  if (!hasMongoUri()) {
    return repairedAnswers;
  }
  const db = await getDb();
  const now = new Date();
  await db.collection<DiagnosticSessionDocument>(COLLECTIONS.diagnosticSessions).updateOne(
    { _id: input.sessionId, visitorId: input.visitorId },
    {
      $set: {
        answers: repairedAnswers,
        completedAt: now,
        updatedAt: now,
      },
    },
  );
  return repairedAnswers;
}

/**
 * Guided diagnostic snapshot from the primary booking linked to this session, if any.
 */
export async function findBookingGuidedSnapshotForDiagnosticSession(sessionId: ObjectId): Promise<string | null> {
  const linked = await fetchPrimaryBookingByDiagnosticSessionIds([sessionId]);
  return linked.get(sessionId.toString())?.guidedDiagnosticSnapshot ?? null;
}
