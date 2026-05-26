/**
 * Marketing booking persistence. Booking documents are append-only in this application:
 * there is no delete path (API or data layer) so CRM history and slot confirmations stay auditable.
 */
import { MongoServerError, ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { FathomMatchStatus } from '@/domain/recording-types';
import type { PaymentGatewayId, PaymentStatus } from '@/domain/payment-types';
import type { BookingDocument, LeadDocument, UserAccountDocument } from '@/domain/types';
import type { UpdateFilter } from 'mongodb';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { getDb } from '@/lib/mongodb';
import { findQuizSessionForBookingSnapshot, findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';
import { buildAccountVisitorId } from '@/lib/server/marketing-auth';

export type BookingRow = {
  id: string;
  leadId: string;
  visitorId: string;
  serviceKey: string;
  startsAtIso: string;
  timezone: string;
  status: BookingDocument['status'];
  meetingUrl?: string;
  zoomMeetingId?: string;
  googleMeetEventId?: string;
  teamsOnlineMeetingId?: string;
  /** Linked checkout transaction when payment was taken online. */
  paymentTransactionId: string | null;
  paymentStatus: PaymentStatus | null;
  paymentGatewayId: PaymentGatewayId | null;
  paymentMethodLabel: string | null;
  paymentProviderRef: string | null;
  hasDiagnosticSnapshot: boolean;
  /** Quiz session document id captured at booking time, when Mongo had a session row. */
  quizSessionId: string | null;
  quotedAmountCentavos: number | null;
  quoteExpiresAtIso: string | null;
  recordingOptIn: boolean;
  recordingOptInPriceCentavos: number | null;
  fathomRecordingId?: string;
  fathomShareUrl?: string;
  fathomSummary?: string;
  fathomActionItems?: string[];
  fathomMatchStatus?: FathomMatchStatus;
  fathomProcessedAtIso?: string | null;
  fathomNotesEmailSentAtIso?: string | null;
};

/** Admin calendar row with lead contact and guest/account context for hover previews. */
export type AdminBookingCalendarRow = BookingRow & {
  readonly contactName: string;
  readonly contactEmail: string | null;
  readonly contactCompany: string | null;
  readonly contactPhone: string | null;
  readonly isGuestBooking: boolean;
  readonly accountEmail: string | null;
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
    zoomMeetingId: doc.zoomMeetingId,
    googleMeetEventId: doc.googleMeetEventId,
    teamsOnlineMeetingId: doc.teamsOnlineMeetingId,
    paymentTransactionId:
      doc.paymentTransactionId !== undefined && doc.paymentTransactionId !== null
        ? doc.paymentTransactionId.toString()
        : null,
    paymentStatus: doc.paymentStatus ?? null,
    paymentGatewayId: doc.paymentGatewayId ?? null,
    paymentMethodLabel: doc.paymentMethodLabel ?? null,
    paymentProviderRef: doc.paymentProviderRef ?? null,
    hasDiagnosticSnapshot:
      typeof doc.guidedDiagnosticSnapshot === 'string' && doc.guidedDiagnosticSnapshot.trim().length > 0,
    quizSessionId,
    quotedAmountCentavos:
      typeof doc.quotedAmountCentavos === 'number' && Number.isFinite(doc.quotedAmountCentavos)
        ? doc.quotedAmountCentavos
        : null,
    quoteExpiresAtIso:
      doc.quoteExpiresAt instanceof Date ? doc.quoteExpiresAt.toISOString() : null,
    recordingOptIn: doc.recordingOptIn === true,
    recordingOptInPriceCentavos:
      typeof doc.recordingOptInPriceCentavos === 'number' && Number.isFinite(doc.recordingOptInPriceCentavos)
        ? doc.recordingOptInPriceCentavos
        : null,
    fathomRecordingId: doc.fathomRecordingId,
    fathomShareUrl: doc.fathomShareUrl,
    fathomSummary: doc.fathomSummary,
    fathomActionItems: doc.fathomActionItems,
    fathomMatchStatus: doc.fathomMatchStatus,
    fathomProcessedAtIso: doc.fathomProcessedAt instanceof Date ? doc.fathomProcessedAt.toISOString() : null,
    fathomNotesEmailSentAtIso:
      doc.fathomNotesEmailSentAt instanceof Date ? doc.fathomNotesEmailSentAt.toISOString() : null,
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

function formatLeadContactField(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === '—') {
    return null;
  }
  return trimmed;
}

function mapLeadContactFields(lead: LeadDocument): {
  readonly contactName: string;
  readonly contactEmail: string | null;
  readonly contactCompany: string | null;
  readonly contactPhone: string | null;
} {
  const contactNameRaw = typeof lead.name === 'string' ? lead.name.trim() : '';
  const contactName = contactNameRaw.length > 0 ? contactNameRaw : 'Customer';
  return {
    contactName,
    contactEmail: formatLeadContactField(lead.email),
    contactCompany: formatLeadContactField(lead.company),
    contactPhone: formatLeadContactField(lead.phone),
  };
}

function resolveIsGuestBooking(visitorId: string, accountVisitorIds: ReadonlySet<string>): boolean {
  return !accountVisitorIds.has(visitorId);
}

async function loadAccountVisitorContext(): Promise<{
  readonly accountVisitorIds: ReadonlySet<string>;
  readonly accountEmailByVisitorId: ReadonlyMap<string, string>;
}> {
  const db = await getDb();
  const userDocs = await db
    .collection<UserAccountDocument>(COLLECTIONS.users)
    .find({}, { projection: { emailNormalized: 1 } })
    .toArray();
  const accountVisitorIds = new Set<string>();
  const accountEmailByVisitorId = new Map<string, string>();
  for (const userDoc of userDocs) {
    if (userDoc._id === undefined) {
      continue;
    }
    const visitorId = buildAccountVisitorId(userDoc._id.toHexString());
    accountVisitorIds.add(visitorId);
    accountEmailByVisitorId.set(visitorId, userDoc.emailNormalized);
  }
  return { accountVisitorIds, accountEmailByVisitorId };
}

/**
 * Admin calendar list: bookings with lead contact fields and guest vs signed-in account context.
 */
export async function listBookingsForAdminCalendar(limit = 10_000): Promise<AdminBookingCalendarRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const [bookingDocs, accountContext] = await Promise.all([
    db
      .collection<BookingDocument>(COLLECTIONS.bookings)
      .find()
      .sort({ startsAt: -1 })
      .limit(limit)
      .toArray(),
    loadAccountVisitorContext(),
  ]);
  const leadIds = [
    ...new Set(
      bookingDocs
        .map((doc) => doc.leadId)
        .filter((leadId): leadId is ObjectId => leadId !== undefined),
    ),
  ];
  const leadDocs =
    leadIds.length === 0
      ? []
      : await db
          .collection<LeadDocument>(COLLECTIONS.leads)
          .find({ _id: { $in: leadIds } })
          .toArray();
  const leadById = new Map<string, LeadDocument>();
  for (const leadDoc of leadDocs) {
    if (leadDoc._id === undefined) {
      continue;
    }
    leadById.set(leadDoc._id.toHexString(), leadDoc);
  }
  return bookingDocs.map((doc) => {
    const base = mapBooking(
      doc as BookingDocument & {
        _id: { toString: () => string };
        leadId: { toString: () => string };
      },
    );
    const lead = leadById.get(base.leadId);
    const contact =
      lead !== undefined
        ? mapLeadContactFields(lead)
        : {
            contactName: 'Unknown lead',
            contactEmail: null,
            contactCompany: null,
            contactPhone: null,
          };
    const accountEmail = accountContext.accountEmailByVisitorId.get(base.visitorId) ?? null;
    return {
      ...base,
      ...contact,
      isGuestBooking: resolveIsGuestBooking(base.visitorId, accountContext.accountVisitorIds),
      accountEmail,
    };
  });
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
}): Promise<
  | { readonly bookingId: ObjectId; readonly quizSessionId: ObjectId | null }
  | 'duplicate_key'
  | 'quiz_session_not_accessible'
  | null
> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const preferredRaw = input.preferredQuizSessionId?.trim() ?? '';
  let session =
    preferredRaw.length > 0 && /^[a-f\d]{24}$/i.test(preferredRaw)
      ? await findQuizSessionForVisitor(input.visitorId, preferredRaw)
      : null;
  if (preferredRaw.length > 0 && session === null) {
    return 'quiz_session_not_accessible';
  }
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

export type PrimaryBookingSlotRow = {
  readonly bookingId: string;
  readonly status: BookingDocument['status'];
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly paymentTransactionId: string | null;
  readonly paymentMethodLabel: string | null;
  readonly paymentStatus: BookingDocument['paymentStatus'] | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerCompany: string | null;
  readonly customerPhone: string | null;
};

/**
 * Earliest booking row for a quiz session (matches the paginated account list lookup order).
 */
export async function findPrimaryBookingSlotByQuizSessionId(quizSessionId: ObjectId): Promise<PrimaryBookingSlotRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne(
    { quizSessionId },
    {
      sort: { createdAt: 1 },
      projection: {
        status: 1,
        startsAt: 1,
        timezone: 1,
        serviceKey: 1,
        meetingUrl: 1,
        paymentTransactionId: 1,
        paymentMethodLabel: 1,
        paymentStatus: 1,
        leadId: 1,
      },
    },
  );
  if (doc === null || doc._id === undefined || doc.startsAt === undefined) {
    return null;
  }
  let customerName: string | null = null;
  let customerEmail: string | null = null;
  let customerCompany: string | null = null;
  let customerPhone: string | null = null;
  if (doc.leadId !== undefined) {
    const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne(
      { _id: doc.leadId },
      { projection: { name: 1, email: 1, company: 1, phone: 1 } },
    );
    if (leadDoc !== null) {
      const nameRaw = typeof leadDoc.name === 'string' ? leadDoc.name.trim() : '';
      const emailRaw = typeof leadDoc.email === 'string' ? leadDoc.email.trim() : '';
      const companyRaw = typeof leadDoc.company === 'string' ? leadDoc.company.trim() : '';
      const phoneRaw = typeof leadDoc.phone === 'string' ? leadDoc.phone.trim() : '';
      customerName = nameRaw.length > 0 ? nameRaw : null;
      customerEmail = emailRaw.length > 0 ? emailRaw : null;
      customerCompany = companyRaw.length > 0 ? companyRaw : null;
      customerPhone = phoneRaw.length > 0 ? phoneRaw : null;
    }
  }
  const meetingRaw = doc.meetingUrl;
  const meetingUrl = typeof meetingRaw === 'string' && meetingRaw.trim().length > 0 ? meetingRaw.trim() : null;
  const paymentMethodRaw = doc.paymentMethodLabel;
  const paymentMethodLabel =
    typeof paymentMethodRaw === 'string' && paymentMethodRaw.trim().length > 0 ? paymentMethodRaw.trim() : null;
  return {
    bookingId: doc._id.toString(),
    status: doc.status,
    startsAtIso: doc.startsAt.toISOString(),
    timezone: doc.timezone,
    serviceKey: doc.serviceKey,
    meetingUrl,
    paymentTransactionId:
      doc.paymentTransactionId !== undefined && doc.paymentTransactionId !== null
        ? doc.paymentTransactionId.toString()
        : null,
    paymentMethodLabel,
    paymentStatus: doc.paymentStatus ?? null,
    customerName,
    customerEmail,
    customerCompany,
    customerPhone,
  };
}

export type UpdateBookingQuoteInput = {
  readonly quotedAmountCentavos: number | null;
  readonly quoteExpiresAt: Date | null;
};

/**
 * Sets or clears a custom checkout quote on a pending booking.
 */
export async function updateBookingQuote(
  bookingId: string,
  input: UpdateBookingQuoteInput,
): Promise<BookingDetailRow | null> {
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
  const existing = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: objectId });
  if (existing === null) {
    return null;
  }
  if (existing.status !== 'pending') {
    throw new Error('Custom quotes can only be set on pending bookings.');
  }
  if (existing.paymentStatus === 'paid') {
    throw new Error('This booking is already paid.');
  }
  const quoteUpdate: UpdateFilter<BookingDocument> =
    input.quotedAmountCentavos === null
      ? {
          $unset: { quotedAmountCentavos: true, quoteExpiresAt: true },
          $set: { updatedAt: new Date() },
        }
      : {
          $set: {
            quotedAmountCentavos: Math.max(100, Math.min(100_000_000, Math.round(input.quotedAmountCentavos))),
            quoteExpiresAt: input.quoteExpiresAt,
            updatedAt: new Date(),
          },
        };
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne({ _id: objectId }, quoteUpdate);
  return findBookingById(bookingId);
}
