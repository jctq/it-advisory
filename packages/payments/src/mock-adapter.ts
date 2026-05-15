import type {
  PaymentGatewayAdapter,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  ReconcileCheckoutSessionInput,
} from './types';

export function createMockPaymentAdapter(successUrl: string): PaymentGatewayAdapter {
  return {
    gatewayId: 'paymongo',
    getCapabilities(): readonly string[] {
      return ['Card', 'GCash', 'Maya'];
    },
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
      const providerRef = `mock_${input.referenceId}_${input.paymentMethodId}`;
      const separator = successUrl.includes('?') ? '&' : '?';
      const redirectUrl = `${successUrl}${separator}mock=1&providerRef=${encodeURIComponent(providerRef)}`;
      return {
        providerRef,
        providerSessionId: providerRef,
        redirectUrl,
      };
    },
    async reconcileCheckoutSession(input: ReconcileCheckoutSessionInput): Promise<ParsedWebhookEvent | null> {
      return {
        providerRef: input.providerRef,
        providerSessionId: input.providerSessionId,
        status: 'paid',
        raw: { mock: true },
      };
    },
    parseWebhook(): null {
      return null;
    },
    async testConnection(): Promise<{ readonly ok: boolean; readonly message: string }> {
      return { ok: true, message: 'Mock adapter is always available.' };
    },
  };
}
