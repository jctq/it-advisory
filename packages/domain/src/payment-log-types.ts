import type { PaymentGatewayId, PaymentStatus } from './payment-types.js';

export const PAYMENT_LOG_OUTCOMES = [
  'credentials_missing',
  'parse_failed',
  'transaction_not_found',
  'updated',
  'noop',
  'processing_failed',
  'unexpected_error',
] as const;

export type PaymentLogOutcome = (typeof PAYMENT_LOG_OUTCOMES)[number];

/** Append-only log of inbound payment gateway webhook events (admin visibility). */
export type PaymentLogDocument = {
  readonly gatewayId: PaymentGatewayId;
  readonly receivedAt: Date;
  readonly finishedAt?: Date;
  readonly durationMs?: number;
  readonly httpStatus: number;
  readonly outcome: PaymentLogOutcome;
  readonly errorMessage?: string;
  readonly providerSessionId?: string;
  readonly providerRef?: string;
  readonly reportedStatus?: PaymentStatus;
  readonly amountCentavos?: number;
  readonly transactionId?: string;
  readonly transactionStatusBefore?: PaymentStatus;
  readonly transactionStatusAfter?: PaymentStatus;
  readonly bookingId?: string;
  readonly visitorId?: string;
  readonly customerEmail?: string;
  readonly customerName?: string;
  readonly serviceKey?: string;
  readonly paymentMethodLabel?: string;
  readonly expiresAtIso?: string;
  readonly processingKind?: 'updated' | 'noop';
  readonly rawPayloadSnippet?: string;
  readonly requestHeadersSummary?: Readonly<Record<string, string>>;
};
