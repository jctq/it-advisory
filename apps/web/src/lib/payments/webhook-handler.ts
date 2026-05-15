import type { PaymentGatewayId } from '@/domain/payment-types';
import { getGatewayCredentials } from '@/lib/data/payment-settings';
import { processWebhookPaymentEvent } from '@/lib/payments/payment-completion';
import { resolvePaymentAdapter } from '@techmd/payments';

export async function handlePaymentGatewayWebhook(input: {
  readonly gatewayId: PaymentGatewayId;
  readonly bodyText: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}): Promise<{ readonly handled: boolean; readonly status: number }> {
  const credentials = await getGatewayCredentials(input.gatewayId);
  if (credentials === null) {
    return { handled: false, status: 401 };
  }
  const adapter = resolvePaymentAdapter(input.gatewayId, credentials);
  const event = adapter.parseWebhook({ bodyText: input.bodyText, headers: input.headers });
  if (event === null) {
    return { handled: false, status: 400 };
  }
  const result = await processWebhookPaymentEvent({
    gatewayId: input.gatewayId,
    providerSessionId: event.providerSessionId,
    status: event.status,
    raw: event.raw,
  });
  if (result === null) {
    return { handled: false, status: 404 };
  }
  return { handled: true, status: 200 };
}
