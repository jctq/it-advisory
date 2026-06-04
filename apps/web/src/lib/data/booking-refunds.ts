import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentGatewayId } from '@/domain/payment-types';
import type { BookingDocument, BookingRefundDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { findLeadById, type MarketingLeadContactRow } from '@/lib/data/leads';
import { findPaymentTransactionById, updatePaymentTransactionStatus } from '@/lib/data/payment-transactions';
import {
  bookingIdMatchesReferenceInput,
  formatBookingReferenceId,
} from '@/lib/marketing/booking-reference';
import type { AdminPaginatedList } from '@/lib/admin/admin-paginated-list';
import { getDb } from '@/lib/mongodb';

export type BookingRefundRow = {
  readonly id: string;
  readonly bookingId: string;
  readonly bookingReference: string;
  readonly visitorId: string;
  readonly paymentTransactionId: string | null;
  readonly requestedAmountCentavos: number;
  readonly refundAmountCentavos: number;
  readonly currency: 'PHP';
  readonly gatewayId: PaymentGatewayId | null;
  readonly status: BookingRefundDocument['status'];
  readonly requestedAtIso: string;
  readonly completedAtIso: string | null;
  readonly adminNotes: string | null;
  readonly bookingReferenceConfirmed: string;
  readonly bookingStartsAtIso: string;
  readonly bookingTimezone: string;
  readonly serviceKey: string;
  readonly customerName: string;
  readonly customerEmail: string | null;
  readonly bookingStatus: BookingDocument['status'];
};

export type BookingRefundListStatusFilter = 'all' | 'awaiting' | 'completed';

export type BookingRefundListSearchField = 'reference' | 'contact' | 'email' | 'status';

export type BookingRefundStatusCounts = {
  readonly all: number;
  readonly awaiting: number;
  readonly completed: number;
};

export type BookingRefundAdminPage = AdminPaginatedList<BookingRefundRow> & {
  readonly countsByStatus: BookingRefundStatusCounts;
};

export type CreateBookingRefundRequestInput = {
  readonly bookingId: string;
  readonly visitorId: string;
  readonly paymentTransactionId: string | null;
  readonly requestedAmountCentavos: number;
  readonly gatewayId: PaymentGatewayId | null;
  readonly bookingReferenceConfirmed: string;
};

export type CreateBookingRefundRequestResult =
  | { readonly ok: true; readonly refundId: string }
  | { readonly ok: false; readonly code: 'database_unavailable' | 'server_error' };

export type CompleteBookingRefundByAdminResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'not_found' | 'invalid_state' | 'database_unavailable' | 'server_error';
    };

function mapRefundRow(
  refund: BookingRefundDocument & { _id: ObjectId },
  booking: BookingDocument & { _id: ObjectId },
  lead: MarketingLeadContactRow | null,
): BookingRefundRow {
  const bookingId = booking._id.toString();
  return {
    id: refund._id.toString(),
    bookingId,
    bookingReference: formatBookingReferenceId(bookingId),
    visitorId: refund.visitorId,
    paymentTransactionId: refund.paymentTransactionId?.toString() ?? null,
    requestedAmountCentavos: refund.requestedAmountCentavos,
    refundAmountCentavos: refund.refundAmountCentavos,
    currency: refund.currency,
    gatewayId: refund.gatewayId,
    status: refund.status,
    requestedAtIso: refund.requestedAt.toISOString(),
    completedAtIso: refund.completedAt?.toISOString() ?? null,
    adminNotes: refund.adminNotes ?? null,
    bookingReferenceConfirmed: refund.bookingReferenceConfirmed,
    bookingStartsAtIso: booking.startsAt.toISOString(),
    bookingTimezone: booking.timezone,
    serviceKey: booking.serviceKey,
    customerName: lead?.name?.trim() ?? 'Customer',
    customerEmail: lead?.email?.trim() ?? null,
    bookingStatus: booking.status,
  };
}

export async function createBookingRefundRequest(
  input: CreateBookingRefundRequestInput,
): Promise<CreateBookingRefundRequestResult> {
  if (!process.env.MONGODB_URI) {
    return { ok: false, code: 'database_unavailable' };
  }
  let bookingObjectId: ObjectId;
  try {
    bookingObjectId = new ObjectId(input.bookingId);
  } catch {
    return { ok: false, code: 'server_error' };
  }
  const now = new Date();
  const paymentTransactionObjectId =
    input.paymentTransactionId !== null && input.paymentTransactionId.trim().length > 0
      ? new ObjectId(input.paymentTransactionId)
      : null;
  const refundDoc: BookingRefundDocument = {
    bookingId: bookingObjectId,
    visitorId: input.visitorId,
    paymentTransactionId: paymentTransactionObjectId,
    requestedAmountCentavos: input.requestedAmountCentavos,
    refundAmountCentavos: input.requestedAmountCentavos,
    currency: 'PHP',
    gatewayId: input.gatewayId,
    status: 'awaiting',
    requestedAt: now,
    completedAt: null,
    adminNotes: null,
    bookingReferenceConfirmed: input.bookingReferenceConfirmed,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const db = await getDb();
    const insertResult = await db.collection<BookingRefundDocument>(COLLECTIONS.bookingRefunds).insertOne(refundDoc);
    if (!insertResult.acknowledged) {
      return { ok: false, code: 'server_error' };
    }
    const updateResult = await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
      { _id: bookingObjectId, status: { $in: ['confirmed', 'completed'] } },
      {
        $set: {
          status: 'refund_awaiting',
          refundRequestedAt: now,
          updatedAt: now,
        },
      },
    );
    if (updateResult.matchedCount !== 1) {
      await db.collection<BookingRefundDocument>(COLLECTIONS.bookingRefunds).deleteOne({ _id: insertResult.insertedId });
      return { ok: false, code: 'server_error' };
    }
    return { ok: true, refundId: insertResult.insertedId.toString() };
  } catch {
    return { ok: false, code: 'server_error' };
  }
}

function bookingRefundRowMatchesSearch(
  row: BookingRefundRow,
  searchField: BookingRefundListSearchField,
  searchQuery: string,
): boolean {
  const normalizedQuery = searchQuery.trim();
  if (normalizedQuery.length === 0) {
    return true;
  }
  const needle = normalizedQuery.toLowerCase();
  if (searchField === 'reference') {
    return (
      row.bookingReference.toLowerCase().includes(needle) ||
      bookingIdMatchesReferenceInput(row.bookingId, normalizedQuery)
    );
  }
  if (searchField === 'contact') {
    return row.customerName.toLowerCase().includes(needle);
  }
  if (searchField === 'email') {
    return (row.customerEmail ?? '').toLowerCase().includes(needle);
  }
  return row.status.toLowerCase().includes(needle);
}

async function buildBookingRefundRowsForAdmin(
  refundDocs: readonly (BookingRefundDocument & { _id: ObjectId })[],
): Promise<BookingRefundRow[]> {
  const db = await getDb();
  const rows: BookingRefundRow[] = [];
  for (const refundDoc of refundDocs) {
    const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: refundDoc.bookingId });
    if (bookingDoc === null || bookingDoc._id === undefined) {
      continue;
    }
    const lead = bookingDoc.leadId !== undefined ? await findLeadById(bookingDoc.leadId.toString()) : null;
    rows.push(
      mapRefundRow(
        refundDoc,
        bookingDoc as BookingDocument & { _id: ObjectId },
        lead,
      ),
    );
  }
  return rows;
}

export async function listBookingRefundsForAdmin(input: {
  readonly page: number;
  readonly pageSize: number;
  readonly status: BookingRefundListStatusFilter;
  readonly searchField?: BookingRefundListSearchField;
  readonly searchQuery?: string;
}): Promise<BookingRefundAdminPage | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const skip = (page - 1) * pageSize;
  const searchField = input.searchField ?? 'reference';
  const searchQuery = input.searchQuery?.trim() ?? '';
  const hasSearchQuery = searchQuery.length > 0;
  const filter: Record<string, unknown> =
    input.status === 'all' ? {} : { status: input.status };
  const db = await getDb();
  const collection = db.collection<BookingRefundDocument>(COLLECTIONS.bookingRefunds);
  const countsByStatus = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ status: 'awaiting' }),
    collection.countDocuments({ status: 'completed' }),
  ]).then(([all, awaiting, completed]) => ({ all, awaiting, completed }));
  if (hasSearchQuery) {
    const refundDocs = await collection.find(filter).sort({ requestedAt: -1 }).toArray();
    const typedRefundDocs = refundDocs.filter(
      (refundDoc): refundDoc is BookingRefundDocument & { _id: ObjectId } => refundDoc._id !== undefined,
    );
    const allRows = await buildBookingRefundRowsForAdmin(typedRefundDocs);
    const filteredRows = allRows.filter((row) => bookingRefundRowMatchesSearch(row, searchField, searchQuery));
    const totalCount = filteredRows.length;
    const rows = filteredRows.slice(skip, skip + pageSize);
    const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
    return {
      rows,
      totalCount,
      page,
      pageSize,
      totalPages,
      countsByStatus,
    };
  }
  const [totalCount, refundDocs] = await Promise.all([
    collection.countDocuments(filter),
    collection.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(pageSize).toArray(),
  ]);
  const typedRefundDocs = refundDocs.filter(
    (refundDoc): refundDoc is BookingRefundDocument & { _id: ObjectId } => refundDoc._id !== undefined,
  );
  const rows = await buildBookingRefundRowsForAdmin(typedRefundDocs);
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages,
    countsByStatus,
  };
}

export async function completeBookingRefundByAdmin(input: {
  readonly refundId: string;
  readonly refundAmountCentavos?: number;
  readonly adminNotes?: string | null;
}): Promise<CompleteBookingRefundByAdminResult> {
  if (!process.env.MONGODB_URI) {
    return { ok: false, code: 'database_unavailable' };
  }
  let refundObjectId: ObjectId;
  try {
    refundObjectId = new ObjectId(input.refundId);
  } catch {
    return { ok: false, code: 'not_found' };
  }
  const db = await getDb();
  const refundDoc = await db.collection<BookingRefundDocument>(COLLECTIONS.bookingRefunds).findOne({ _id: refundObjectId });
  if (refundDoc === null || refundDoc._id === undefined) {
    return { ok: false, code: 'not_found' };
  }
  if (refundDoc.status !== 'awaiting') {
    return { ok: false, code: 'invalid_state' };
  }
  const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: refundDoc.bookingId });
  if (bookingDoc === null || bookingDoc.status !== 'refund_awaiting') {
    return { ok: false, code: 'invalid_state' };
  }
  const now = new Date();
  const finalAmount =
    input.refundAmountCentavos !== undefined && Number.isFinite(input.refundAmountCentavos)
      ? Math.max(0, Math.round(input.refundAmountCentavos))
      : refundDoc.requestedAmountCentavos;
  const adminNotes =
    typeof input.adminNotes === 'string' && input.adminNotes.trim().length > 0 ? input.adminNotes.trim() : null;
  try {
    await db.collection<BookingRefundDocument>(COLLECTIONS.bookingRefunds).updateOne(
      { _id: refundObjectId, status: 'awaiting' },
      {
        $set: {
          status: 'completed',
          refundAmountCentavos: finalAmount,
          completedAt: now,
          adminNotes,
          updatedAt: now,
        },
      },
    );
    await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
      { _id: refundDoc.bookingId, status: 'refund_awaiting' },
      {
        $set: {
          status: 'refunded',
          paymentStatus: 'refunded',
          refundCompletedAt: now,
          updatedAt: now,
        },
      },
    );
    if (refundDoc.paymentTransactionId !== null && refundDoc.paymentTransactionId !== undefined) {
      await updatePaymentTransactionStatus({
        transactionId: refundDoc.paymentTransactionId.toString(),
        status: 'refunded',
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, code: 'server_error' };
  }
}

export async function findBookingRefundByBookingId(bookingId: string): Promise<BookingRefundRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  let bookingObjectId: ObjectId;
  try {
    bookingObjectId = new ObjectId(bookingId);
  } catch {
    return null;
  }
  const db = await getDb();
  const refundDoc = await db.collection<BookingRefundDocument>(COLLECTIONS.bookingRefunds).findOne({ bookingId: bookingObjectId });
  if (refundDoc === null || refundDoc._id === undefined) {
    return null;
  }
  const booking = await findBookingById(bookingId);
  if (booking === null) {
    return null;
  }
  const lead = await findLeadById(booking.leadId);
  const bookingDoc = await db.collection<BookingDocument>(COLLECTIONS.bookings).findOne({ _id: bookingObjectId });
  if (bookingDoc === null || bookingDoc._id === undefined) {
    return null;
  }
  return mapRefundRow(
    refundDoc as BookingRefundDocument & { _id: ObjectId },
    bookingDoc as BookingDocument & { _id: ObjectId },
    lead,
  );
}
