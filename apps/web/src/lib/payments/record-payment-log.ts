import { COLLECTIONS } from '@/domain/collections';
import type { PaymentLogDocument } from '@/domain/payment-log-types';
import { getDb } from '@/lib/mongodb';

const SIGNATURE_HEADER_KEYS = [
  'paymongo-signature',
  'x-callback-token',
  'x-xendit-signature',
  'hitpay-signature',
  'paypal-transmission-id',
  'paypal-transmission-sig',
  'paypal-cert-url',
  'paypal-auth-algo',
] as const;

const METADATA_HEADER_KEYS = ['content-type', 'user-agent', 'x-forwarded-for', 'x-real-ip'] as const;

function resolveHeaderValue(
  headers: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  const direct = headers[key];
  if (direct !== undefined) {
    return direct;
  }
  const lower = headers[key.toLowerCase()];
  if (lower !== undefined) {
    return lower;
  }
  const normalizedKey = key.toLowerCase();
  for (const [headerKey, headerValue] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === normalizedKey) {
      return headerValue;
    }
  }
  return undefined;
}

export function summarizePaymentLogHeaders(
  headers: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> {
  const summary: Record<string, string> = {};
  for (const key of SIGNATURE_HEADER_KEYS) {
    const value = resolveHeaderValue(headers, key);
    summary[key] = value !== undefined && value.trim().length > 0 ? 'present' : 'absent';
  }
  for (const key of METADATA_HEADER_KEYS) {
    const value = resolveHeaderValue(headers, key);
    if (value !== undefined && value.trim().length > 0) {
      summary[key] = value.length > 120 ? `${value.slice(0, 117)}…` : value;
    }
  }
  return summary;
}

export async function recordPaymentLog(
  input: Omit<PaymentLogDocument, 'finishedAt' | 'durationMs'> & {
    readonly startedAtMs: number;
  },
): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  const finishedAt = new Date();
  const durationMs = Math.max(0, finishedAt.getTime() - input.startedAtMs);
  const doc: PaymentLogDocument = {
    gatewayId: input.gatewayId,
    receivedAt: input.receivedAt,
    finishedAt,
    durationMs,
    httpStatus: input.httpStatus,
    outcome: input.outcome,
    ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
    ...(input.providerSessionId !== undefined ? { providerSessionId: input.providerSessionId } : {}),
    ...(input.providerRef !== undefined ? { providerRef: input.providerRef } : {}),
    ...(input.reportedStatus !== undefined ? { reportedStatus: input.reportedStatus } : {}),
    ...(input.amountCentavos !== undefined ? { amountCentavos: input.amountCentavos } : {}),
    ...(input.transactionId !== undefined ? { transactionId: input.transactionId } : {}),
    ...(input.transactionStatusBefore !== undefined ? { transactionStatusBefore: input.transactionStatusBefore } : {}),
    ...(input.transactionStatusAfter !== undefined ? { transactionStatusAfter: input.transactionStatusAfter } : {}),
    ...(input.bookingId !== undefined ? { bookingId: input.bookingId } : {}),
    ...(input.visitorId !== undefined ? { visitorId: input.visitorId } : {}),
    ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
    ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
    ...(input.serviceKey !== undefined ? { serviceKey: input.serviceKey } : {}),
    ...(input.paymentMethodLabel !== undefined ? { paymentMethodLabel: input.paymentMethodLabel } : {}),
    ...(input.expiresAtIso !== undefined ? { expiresAtIso: input.expiresAtIso } : {}),
    ...(input.processingKind !== undefined ? { processingKind: input.processingKind } : {}),
    ...(input.rawPayloadSnippet !== undefined ? { rawPayloadSnippet: input.rawPayloadSnippet } : {}),
    ...(input.requestHeadersSummary !== undefined ? { requestHeadersSummary: input.requestHeadersSummary } : {}),
  };
  const db = await getDb();
  await db.collection<PaymentLogDocument>(COLLECTIONS.paymentLogs).insertOne(doc);
}

export function appendPaymentLog(
  input: Omit<PaymentLogDocument, 'finishedAt' | 'durationMs'> & {
    readonly startedAtMs: number;
  },
): void {
  void recordPaymentLog(input).catch((error: unknown) => {
    console.error('[payment-log] failed to persist log entry', error);
  });
}
