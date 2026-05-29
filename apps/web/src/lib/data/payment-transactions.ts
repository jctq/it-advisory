import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentGatewayId, PaymentPolicy, PaymentStatus, PaymentTransactionDocument } from '@/domain/payment-types';
import { getDb } from '@/lib/mongodb';

export type PaymentTransactionRow = {
  readonly id: string;
  readonly gatewayId: PaymentGatewayId;
  readonly providerRef: string;
  readonly providerSessionId: string;
  readonly status: PaymentStatus;
  readonly paymentPolicy: PaymentPolicy;
  readonly amountCentavos: number;
  readonly currency: 'PHP';
  readonly visitorId: string;
  readonly bookingId: string | null;
  readonly bookingDraftId: string;
  readonly serviceKey: string;
  readonly timezone: string;
  readonly leadId: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerCompany: string | null;
  readonly customerPhone: string | null;
  readonly quizSessionIdHex: string | null;
  readonly redirectUrl: string | null;
  readonly paymentMethodLabel: string | null;
  readonly startsAtIso: string;
  readonly expiresAtIso: string | null;
  readonly createdAtIso: string;
  readonly paidAtIso: string | null;
  readonly metadata?: Record<string, string>;
};

function mapTransaction(
  doc: PaymentTransactionDocument & { _id: { toString: () => string } },
): PaymentTransactionRow {
  return {
    id: doc._id.toString(),
    gatewayId: doc.gatewayId,
    providerRef: doc.providerRef,
    providerSessionId: doc.providerSessionId,
    status: doc.status,
    paymentPolicy: doc.paymentPolicy,
    amountCentavos: doc.amountCentavos,
    currency: doc.currency,
    visitorId: doc.visitorId,
    bookingId: doc.bookingId !== undefined && doc.bookingId !== null ? doc.bookingId.toString() : null,
    bookingDraftId: doc.bookingDraftId,
    serviceKey: doc.serviceKey,
    timezone: doc.timezone,
    leadId: doc.leadId !== undefined && doc.leadId !== null ? doc.leadId.toString() : null,
    customerName: doc.customerName ?? null,
    customerEmail: doc.customerEmail ?? null,
    customerCompany: doc.customerCompany ?? null,
    customerPhone: doc.customerPhone ?? null,
    quizSessionIdHex: doc.quizSessionIdHex ?? null,
    redirectUrl: doc.redirectUrl ?? null,
    paymentMethodLabel: doc.paymentMethodLabel ?? null,
    startsAtIso: doc.startsAt.toISOString(),
    expiresAtIso: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    createdAtIso: doc.createdAt.toISOString(),
    paidAtIso: doc.paidAt ? doc.paidAt.toISOString() : null,
    metadata: doc.metadata,
  };
}

export type CreatePaymentTransactionInput = {
  readonly gatewayId: PaymentGatewayId;
  readonly providerRef: string;
  readonly providerSessionId: string;
  readonly paymentPolicy: PaymentPolicy;
  readonly amountCentavos: number;
  readonly visitorId: string;
  readonly bookingDraftId: string;
  readonly serviceKey: string;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly leadId?: ObjectId | null;
  readonly customerName?: string | null;
  readonly customerEmail?: string | null;
  readonly customerCompany?: string | null;
  readonly customerPhone?: string | null;
  readonly quizSessionIdHex?: string | null;
  readonly paymentMethodLabel?: string | null;
  readonly redirectUrl?: string | null;
  readonly metadata?: Record<string, string>;
  readonly expiresAt?: Date | null;
  readonly bookingId?: ObjectId | null;
};

export async function insertPaymentTransaction(input: CreatePaymentTransactionInput): Promise<ObjectId | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const now = new Date();
  const doc: Omit<PaymentTransactionDocument, '_id'> = {
    gatewayId: input.gatewayId,
    providerRef: input.providerRef,
    providerSessionId: input.providerSessionId,
    status: 'pending',
    paymentPolicy: input.paymentPolicy,
    amountCentavos: input.amountCentavos,
    currency: 'PHP',
    visitorId: input.visitorId,
    bookingId: input.bookingId ?? null,
    bookingDraftId: input.bookingDraftId,
    serviceKey: input.serviceKey,
    startsAt: input.startsAt,
    timezone: input.timezone,
    leadId: input.leadId ?? undefined,
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    customerCompany: input.customerCompany ?? null,
    customerPhone: input.customerPhone ?? null,
    quizSessionIdHex: input.quizSessionIdHex ?? null,
    paymentMethodLabel: input.paymentMethodLabel ?? null,
    redirectUrl: input.redirectUrl ?? null,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
    expiresAt: input.expiresAt ?? null,
  };
  const db = await getDb();
  const result = await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).insertOne(doc);
  return result.insertedId;
}

export async function findPaymentTransactionById(
  transactionId: string,
  visitorId?: string,
): Promise<PaymentTransactionRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(transactionId);
  } catch {
    return null;
  }
  const db = await getDb();
  const filter: Record<string, unknown> = { _id: objectId };
  if (visitorId !== undefined) {
    filter.visitorId = visitorId;
  }
  const doc = await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).findOne(filter);
  if (!doc) {
    return null;
  }
  return mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } });
}

export async function findPaymentTransactionByProviderSession(
  gatewayId: PaymentGatewayId,
  providerSessionId: string,
): Promise<PaymentTransactionRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).findOne({
    gatewayId,
    providerSessionId,
  });
  if (!doc) {
    return null;
  }
  return mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } });
}

export async function updatePaymentTransactionStatus(input: {
  readonly transactionId: string;
  readonly status: PaymentStatus;
  readonly bookingId?: ObjectId | null;
  readonly rawWebhookPayload?: unknown;
}): Promise<PaymentTransactionRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(input.transactionId);
  } catch {
    return null;
  }
  const now = new Date();
  const setFields: Record<string, unknown> = {
    status: input.status,
    updatedAt: now,
  };
  if (input.status === 'paid') {
    setFields.paidAt = now;
  }
  if (input.bookingId !== undefined) {
    setFields.bookingId = input.bookingId;
  }
  if (input.rawWebhookPayload !== undefined) {
    setFields.rawWebhookPayload = input.rawWebhookPayload;
  }
  const db = await getDb();
  const result = await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).findOneAndUpdate(
    { _id: objectId },
    { $set: setFields },
    { returnDocument: 'after' },
  );
  if (!result) {
    return null;
  }
  return mapTransaction(result as PaymentTransactionDocument & { _id: { toString: () => string } });
}

const RECONCILABLE_PAYMENT_STATUSES: readonly PaymentStatus[] = ['pending', 'processing'];

/**
 * Fast check before scheduling background payment reconciliation.
 */
export async function visitorHasPendingPaymentReconciliation(visitorId: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const db = await getDb();
  const collection = db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions);
  const openCheckout = await collection.findOne(
    {
      visitorId,
      status: { $in: RECONCILABLE_PAYMENT_STATUSES },
    },
    { projection: { _id: 1 } },
  );
  if (openCheckout !== null) {
    return true;
  }
  const paidUnfulfilled = await collection.findOne(
    {
      visitorId,
      status: 'paid',
      $or: [{ bookingId: { $exists: false } }, { bookingId: null }],
    },
    { projection: { _id: 1 } },
  );
  return paidUnfulfilled !== null;
}

export async function listReconcilablePaymentTransactionsForVisitor(
  visitorId: string,
  limit = 50,
): Promise<readonly PaymentTransactionRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      visitorId,
      status: { $in: RECONCILABLE_PAYMENT_STATUSES },
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } }));
}

export async function listPaidUnfulfilledPaymentTransactionsForVisitor(
  visitorId: string,
  limit = 50,
): Promise<readonly PaymentTransactionRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      visitorId,
      status: 'paid',
      $or: [{ bookingId: { $exists: false } }, { bookingId: null }],
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } }));
}

export async function listStaleReconcilablePaymentTransactions(
  olderThan: Date,
  limit = 100,
): Promise<readonly PaymentTransactionRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      status: { $in: RECONCILABLE_PAYMENT_STATUSES },
      updatedAt: { $lte: olderThan },
    })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } }));
}

export type PaymentTransactionSummaryRow = Pick<
  PaymentTransactionRow,
  'id' | 'status' | 'gatewayId' | 'amountCentavos' | 'bookingId' | 'startsAtIso' | 'timezone' | 'serviceKey' | 'paidAtIso'
>;

export async function fetchLatestPaymentTransactionsByQuizSessionIds(
  quizSessionIdHexes: readonly string[],
): Promise<Map<string, PaymentTransactionSummaryRow>> {
  const uniqueIds = [...new Set(quizSessionIdHexes.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (!process.env.MONGODB_URI || uniqueIds.length === 0) {
    return new Map();
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({ quizSessionIdHex: { $in: uniqueIds } })
    .sort({ createdAt: -1 })
    .toArray();
  const bySession = new Map<string, PaymentTransactionSummaryRow>();
  for (const doc of docs) {
    const sessionHex = doc.quizSessionIdHex?.trim() ?? '';
    if (sessionHex.length === 0 || bySession.has(sessionHex) || doc._id === undefined) {
      continue;
    }
    const row = mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } });
    bySession.set(sessionHex, {
      id: row.id,
      status: row.status,
      gatewayId: row.gatewayId,
      amountCentavos: row.amountCentavos,
      bookingId: row.bookingId,
      startsAtIso: row.startsAtIso,
      timezone: row.timezone,
      serviceKey: row.serviceKey,
      paidAtIso: row.paidAtIso,
    });
  }
  return bySession;
}

const OPEN_PAYMENT_TRANSACTION_STATUSES: readonly PaymentStatus[] = ['pending', 'processing'];

function buildActiveOpenPaymentHoldFilter(now: Date): Record<string, unknown> {
  return {
    status: { $in: OPEN_PAYMENT_TRANSACTION_STATUSES },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

/**
 * Lists slot instants reserved by open checkout transactions (e.g. pay-before-booking holds without a booking row yet).
 */
export async function listOpenPaymentHoldStartsUtcInRange(input: {
  readonly rangeStartUtc: Date;
  readonly rangeEndExclusiveUtc: Date;
  readonly nowUtc?: Date;
}): Promise<Date[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const now = input.nowUtc ?? new Date();
  const db = await getDb();
  const cursor = db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find(
      {
        startsAt: { $gte: input.rangeStartUtc, $lt: input.rangeEndExclusiveUtc },
        ...buildActiveOpenPaymentHoldFilter(now),
      },
      { projection: { startsAt: 1 } },
    )
    .sort({ startsAt: 1 });
  const rows = await cursor.toArray();
  return rows.map((row) => row.startsAt);
}

/**
 * Paid checkout rows that still occupy a slot (orphan paid or linked to a non-cancelled booking).
 */
export async function listPaidOccupiedStartsUtcInRange(input: {
  readonly rangeStartUtc: Date;
  readonly rangeEndExclusiveUtc: Date;
}): Promise<Date[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find(
      {
        status: 'paid',
        startsAt: { $gte: input.rangeStartUtc, $lt: input.rangeEndExclusiveUtc },
      },
      { projection: { startsAt: 1, bookingId: 1 } },
    )
    .sort({ startsAt: 1 })
    .toArray();
  if (docs.length === 0) {
    return [];
  }
  const bookingObjectIds: ObjectId[] = [];
  for (const doc of docs) {
    if (doc.bookingId !== undefined && doc.bookingId !== null) {
      bookingObjectIds.push(doc.bookingId);
    }
  }
  const cancelledBookingIds = new Set<string>();
  if (bookingObjectIds.length > 0) {
    const cancelledRows = await db
      .collection(COLLECTIONS.bookings)
      .find(
        { _id: { $in: bookingObjectIds }, status: 'cancelled' },
        { projection: { _id: 1 } },
      )
      .toArray();
    for (const row of cancelledRows) {
      if (row._id !== undefined) {
        cancelledBookingIds.add(row._id.toString());
      }
    }
  }
  const occupied: Date[] = [];
  for (const doc of docs) {
    const bookingId =
      doc.bookingId !== undefined && doc.bookingId !== null ? doc.bookingId.toString() : null;
    if (bookingId !== null && cancelledBookingIds.has(bookingId)) {
      continue;
    }
    occupied.push(doc.startsAt);
  }
  return occupied;
}

/**
 * True when another visitor has an active checkout hold on this instant (no booking document required).
 */
export async function hasGlobalOpenPaymentHoldAtSlot(input: {
  readonly startsAtUtc: Date;
  readonly nowUtc?: Date;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  const now = input.nowUtc ?? new Date();
  const db = await getDb();
  const count = await db.collection(COLLECTIONS.paymentTransactions).countDocuments({
    startsAt: input.startsAtUtc,
    ...buildActiveOpenPaymentHoldFilter(now),
  });
  return count > 0;
}

export async function findOpenPaymentTransactionForBooking(
  bookingId: string,
): Promise<PaymentTransactionRow | null> {
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
  const doc = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      bookingId: bookingObjectId,
      status: { $in: OPEN_PAYMENT_TRANSACTION_STATUSES },
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (doc === null) {
    return null;
  }
  return mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } });
}

export async function findOpenPaymentTransactionForCheckoutSlot(input: {
  readonly visitorId: string;
  readonly quizSessionIdHex: string;
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
}): Promise<PaymentTransactionRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const sessionHex = input.quizSessionIdHex.trim();
  if (sessionHex.length === 0) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      visitorId: input.visitorId,
      quizSessionIdHex: sessionHex,
      serviceKey: input.serviceKey,
      startsAt: input.startsAtUtc,
      status: { $in: OPEN_PAYMENT_TRANSACTION_STATUSES },
      $or: [{ bookingId: { $exists: false } }, { bookingId: null }],
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (doc === null) {
    return null;
  }
  return mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } });
}

export async function listOpenPaymentTransactionsByQuizSessionIdHex(
  quizSessionIdHex: string,
): Promise<readonly PaymentTransactionRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const sessionHex = quizSessionIdHex.trim();
  if (sessionHex.length === 0) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      quizSessionIdHex: sessionHex,
      status: { $in: OPEN_PAYMENT_TRANSACTION_STATUSES },
    })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) =>
    mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } }),
  );
}

export async function findLatestPaymentTransactionByQuizSessionIdHex(
  quizSessionIdHex: string,
): Promise<PaymentTransactionRow | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const sessionHex = quizSessionIdHex.trim();
  if (sessionHex.length === 0) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({ quizSessionIdHex: sessionHex })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (doc === null) {
    return null;
  }
  return mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } });
}

export async function listExpiredHoldTransactions(now: Date): Promise<readonly PaymentTransactionRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const db = await getDb();
  const docs = await db
    .collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions)
    .find({
      paymentPolicy: { $in: ['pay_after_hold', 'pay_before_booking'] },
      status: { $in: ['pending', 'processing'] },
      expiresAt: { $lte: now, $ne: null },
    })
    .limit(200)
    .toArray();
  return docs.map((doc) => mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } }));
}
