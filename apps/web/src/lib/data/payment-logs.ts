import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentGatewayId } from '@/domain/payment-types';
import type { PaymentLogDocument, PaymentLogOutcome } from '@/domain/payment-log-types';
import { getDb } from '@/lib/mongodb';

const DEFAULT_PAYMENT_LOG_LIST_LIMIT = 150 as const;

export type PaymentLogAdminRow = {
  readonly id: string;
  readonly gatewayId: PaymentGatewayId;
  readonly gatewayLabel: string;
  readonly receivedAtIso: string;
  readonly durationMs: number | null;
  readonly httpStatus: number;
  readonly outcome: PaymentLogOutcome;
  readonly errorMessage: string | null;
  readonly providerSessionId: string | null;
  readonly providerRef: string | null;
  readonly reportedStatus: string | null;
  readonly amountCentavos: number | null;
  readonly transactionId: string | null;
  readonly transactionStatusBefore: string | null;
  readonly transactionStatusAfter: string | null;
  readonly bookingId: string | null;
  readonly visitorId: string | null;
  readonly customerEmail: string | null;
  readonly customerName: string | null;
  readonly serviceKey: string | null;
  readonly paymentMethodLabel: string | null;
  readonly expiresAtIso: string | null;
  readonly processingKind: 'updated' | 'noop' | null;
  readonly rawPayloadSnippet: string | null;
  readonly requestHeadersSummary: Readonly<Record<string, string>> | null;
};

const GATEWAY_LABELS: Record<PaymentGatewayId, string> = {
  paymongo: 'PayMongo',
  xendit: 'Xendit',
  hitpay: 'HitPay',
  paypal: 'PayPal',
};

function mapPaymentLog(doc: PaymentLogDocument & { _id: ObjectId }): PaymentLogAdminRow {
  return {
    id: doc._id.toString(),
    gatewayId: doc.gatewayId,
    gatewayLabel: GATEWAY_LABELS[doc.gatewayId] ?? doc.gatewayId,
    receivedAtIso: doc.receivedAt.toISOString(),
    durationMs: doc.durationMs ?? null,
    httpStatus: doc.httpStatus,
    outcome: doc.outcome,
    errorMessage: doc.errorMessage ?? null,
    providerSessionId: doc.providerSessionId ?? null,
    providerRef: doc.providerRef ?? null,
    reportedStatus: doc.reportedStatus ?? null,
    amountCentavos: doc.amountCentavos ?? null,
    transactionId: doc.transactionId ?? null,
    transactionStatusBefore: doc.transactionStatusBefore ?? null,
    transactionStatusAfter: doc.transactionStatusAfter ?? null,
    bookingId: doc.bookingId ?? null,
    visitorId: doc.visitorId ?? null,
    customerEmail: doc.customerEmail ?? null,
    customerName: doc.customerName ?? null,
    serviceKey: doc.serviceKey ?? null,
    paymentMethodLabel: doc.paymentMethodLabel ?? null,
    expiresAtIso: doc.expiresAtIso ?? null,
    processingKind: doc.processingKind ?? null,
    rawPayloadSnippet: doc.rawPayloadSnippet ?? null,
    requestHeadersSummary: doc.requestHeadersSummary ?? null,
  };
}

export async function listPaymentLogsForAdmin(
  limit: number = DEFAULT_PAYMENT_LOG_LIST_LIMIT,
): Promise<readonly PaymentLogAdminRow[]> {
  const db = await getDb();
  const docs = await db
    .collection<PaymentLogDocument>(COLLECTIONS.paymentLogs)
    .find({})
    .sort({ receivedAt: -1 })
    .limit(limit)
    .toArray();
  return docs
    .filter((doc): doc is PaymentLogDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapPaymentLog);
}
