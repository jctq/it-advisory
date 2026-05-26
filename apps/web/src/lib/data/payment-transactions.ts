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
      paymentPolicy: 'pay_after_hold',
      status: { $in: ['pending', 'processing'] },
      expiresAt: { $lte: now },
    })
    .limit(200)
    .toArray();
  return docs.map((doc) => mapTransaction(doc as PaymentTransactionDocument & { _id: { toString: () => string } }));
}
