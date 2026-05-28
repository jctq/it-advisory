import type { PaymentGatewayId } from '@/domain/payment-types';
import type { PaymentLogOutcome } from '@/domain/payment-log-types';
import { findPaymentTransactionByProviderSession } from '@/lib/data/payment-transactions';
import { getGatewayCredentials } from '@/lib/data/payment-settings';
import { processWebhookPaymentEvent } from '@/lib/payments/payment-completion';
import { appendPaymentLog, summarizePaymentLogHeaders } from '@/lib/payments/record-payment-log';
import { resolvePaymentAdapter } from '@techmd/payments';

const RAW_PAYLOAD_SNIPPET_MAX_LENGTH = 4000 as const;

export async function handlePaymentGatewayWebhook(input: {
  readonly gatewayId: PaymentGatewayId;
  readonly bodyText: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}): Promise<{ readonly handled: boolean; readonly status: number }> {
  const receivedAt = new Date();
  const startedAtMs = receivedAt.getTime();
  const requestHeadersSummary = summarizePaymentLogHeaders(input.headers);
  const rawPayloadSnippet = input.bodyText.slice(0, RAW_PAYLOAD_SNIPPET_MAX_LENGTH);
  const logBase = {
    gatewayId: input.gatewayId,
    receivedAt,
    startedAtMs,
    rawPayloadSnippet,
    requestHeadersSummary,
  };
  try {
    const credentials = await getGatewayCredentials(input.gatewayId);
    if (credentials === null) {
      appendPaymentLog({
        ...logBase,
        outcome: 'credentials_missing',
        httpStatus: 401,
        errorMessage: 'Gateway credentials are not configured or could not be decrypted.',
      });
      return { handled: false, status: 401 };
    }
    const adapter = resolvePaymentAdapter(input.gatewayId, credentials);
    const event = adapter.parseWebhook({ bodyText: input.bodyText, headers: input.headers });
    if (event === null) {
      appendPaymentLog({
        ...logBase,
        outcome: 'parse_failed',
        httpStatus: 400,
        errorMessage:
          'Webhook payload could not be parsed or verified. Check signature headers, event type, and raw payload.',
      });
      return { handled: false, status: 400 };
    }
    const transaction = await findPaymentTransactionByProviderSession(input.gatewayId, event.providerSessionId);
    if (transaction === null) {
      appendPaymentLog({
        ...logBase,
        outcome: 'transaction_not_found',
        httpStatus: 404,
        providerSessionId: event.providerSessionId,
        providerRef: event.providerRef,
        reportedStatus: event.status,
        amountCentavos: event.amountCentavos,
        errorMessage: `No payment transaction matched providerSessionId "${event.providerSessionId}".`,
      });
      return { handled: false, status: 404 };
    }
    const transactionContext = {
      transactionId: transaction.id,
      transactionStatusBefore: transaction.status,
      bookingId: transaction.bookingId ?? undefined,
      visitorId: transaction.visitorId,
      customerEmail: transaction.customerEmail ?? undefined,
      customerName: transaction.customerName ?? undefined,
      serviceKey: transaction.serviceKey,
      paymentMethodLabel: transaction.paymentMethodLabel ?? undefined,
      expiresAtIso: transaction.expiresAtIso ?? undefined,
      providerSessionId: event.providerSessionId,
      providerRef: event.providerRef,
      reportedStatus: event.status,
      amountCentavos: event.amountCentavos,
    };
    const result = await processWebhookPaymentEvent({
      gatewayId: input.gatewayId,
      providerSessionId: event.providerSessionId,
      status: event.status,
      raw: event.raw,
    });
    if (result === null) {
      appendPaymentLog({
        ...logBase,
        ...transactionContext,
        outcome: 'processing_failed',
        httpStatus: 500,
        errorMessage:
          'Transaction was found but payment completion failed (booking creation, status update, or refresh).',
      });
      return { handled: false, status: 500 };
    }
    const outcome: PaymentLogOutcome = result.kind === 'updated' ? 'updated' : 'noop';
    appendPaymentLog({
      ...logBase,
      ...transactionContext,
      outcome,
      httpStatus: 200,
      transactionStatusAfter: result.transaction.status,
      processingKind: result.kind,
      ...(outcome === 'noop'
        ? {
            errorMessage:
              'Webhook accepted but no state change was applied (transaction already at target status or booking already confirmed).',
          }
        : {}),
    });
    return { handled: true, status: 200 };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[payment-log]', input.gatewayId, error);
    appendPaymentLog({
      ...logBase,
      outcome: 'unexpected_error',
      httpStatus: 500,
      errorMessage,
    });
    return { handled: false, status: 500 };
  }
}
