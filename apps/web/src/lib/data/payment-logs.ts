import { ObjectId, type Filter } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentGatewayId } from '@/domain/payment-types';
import type { PaymentLogDocument, PaymentLogOutcome } from '@/domain/payment-log-types';
import type { AdminPaginatedList } from '@/lib/admin/admin-paginated-list';
import { getDb } from '@/lib/mongodb';

const DEFAULT_PAYMENT_LOG_LIST_LIMIT = 150 as const;

export type PaymentLogListOutcomeFilter = PaymentLogOutcome | 'all';

export type PaymentLogListGatewayFilter = PaymentGatewayId | 'all';

export type PaymentLogAdminPage = AdminPaginatedList<PaymentLogAdminRow>;

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

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPaymentLogListFilter(input: {
  readonly outcome: PaymentLogListOutcomeFilter;
  readonly gatewayId: PaymentLogListGatewayFilter;
  readonly search: string;
}): Filter<PaymentLogDocument> {
  const filters: Filter<PaymentLogDocument>[] = [];
  if (input.outcome !== 'all') {
    filters.push({ outcome: input.outcome });
  }
  if (input.gatewayId !== 'all') {
    filters.push({ gatewayId: input.gatewayId });
  }
  const trimmedSearch = input.search.trim();
  if (trimmedSearch.length > 0) {
    const escapedSearch = escapeRegexLiteral(trimmedSearch);
    const searchRegex = { $regex: escapedSearch, $options: 'i' };
    filters.push({
      $or: [
        { customerEmail: searchRegex },
        { customerName: searchRegex },
        { providerSessionId: searchRegex },
        { providerRef: searchRegex },
        { transactionId: searchRegex },
        { bookingId: searchRegex },
        { visitorId: searchRegex },
        { errorMessage: searchRegex },
      ],
    });
  }
  if (filters.length === 0) {
    return {};
  }
  if (filters.length === 1) {
    return filters[0]!;
  }
  return { $and: filters };
}

export async function listPaymentLogsForAdmin(
  limit: number = DEFAULT_PAYMENT_LOG_LIST_LIMIT,
): Promise<readonly PaymentLogAdminRow[]> {
  const page = await listPaymentLogsForAdminPage({ page: 1, pageSize: limit });
  return page.rows;
}

export async function listPaymentLogsForAdminPage(input: {
  readonly page: number;
  readonly pageSize: number;
  readonly outcome?: PaymentLogListOutcomeFilter;
  readonly gatewayId?: PaymentLogListGatewayFilter;
  readonly search?: string;
}): Promise<PaymentLogAdminPage> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const outcome = input.outcome ?? 'all';
  const gatewayId = input.gatewayId ?? 'all';
  const search = input.search?.trim() ?? '';
  const filter = buildPaymentLogListFilter({ outcome, gatewayId, search });
  const db = await getDb();
  const collection = db.collection<PaymentLogDocument>(COLLECTIONS.paymentLogs);
  const [totalCount, docs] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter)
      .sort({ receivedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);
  const rows = docs
    .filter((doc): doc is PaymentLogDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapPaymentLog);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}
