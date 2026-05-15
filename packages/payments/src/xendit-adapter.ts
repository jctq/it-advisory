import type {
  PaymentGatewayAdapter,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  ReconcileCheckoutSessionInput,
  GatewayCredentials,
} from './types';
import { buildXenditCustomer } from './customer-prefill';
import { resolveXenditPaymentMethods } from './payment-method-types';

const XENDIT_API_BASE = 'https://api.xendit.co';

function resolveSecretKey(credentials: GatewayCredentials): string {
  return (credentials.secretKey ?? credentials.apiKey ?? '').trim();
}

export function createXenditAdapter(credentials: GatewayCredentials): PaymentGatewayAdapter {
  return {
    gatewayId: 'xendit',
    getCapabilities(): readonly string[] {
      return ['Card', 'GCash', 'Maya', 'GrabPay'];
    },
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
      const secretKey = resolveSecretKey(credentials);
      if (secretKey.length === 0) {
        throw new Error('Xendit secret key is not configured.');
      }
      const response = await fetch(`${XENDIT_API_BASE}/v2/invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: input.referenceId,
          amount: input.amountCentavos,
          currency: input.currency,
          description: input.description,
          success_redirect_url: input.successUrl,
          failure_redirect_url: input.cancelUrl,
          metadata: { ...input.metadata, paymentMethodId: input.paymentMethodId },
          ...(() => {
            const paymentMethods = resolveXenditPaymentMethods(input.paymentMethodId);
            return paymentMethods !== null ? { payment_methods: [...paymentMethods] } : {};
          })(),
          ...(() => {
            const customer = buildXenditCustomer(input);
            const payerEmail = input.customerEmail?.trim() ?? '';
            return {
              ...(customer !== undefined ? { customer } : {}),
              ...(payerEmail.length > 0 ? { payer_email: payerEmail } : {}),
            };
          })(),
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload === 'object' ? JSON.stringify(payload) : `Xendit HTTP ${response.status}`);
      }
      const invoice = payload as { id?: string; invoice_url?: string; external_id?: string };
      const providerSessionId = invoice.id ?? '';
      const redirectUrl = invoice.invoice_url ?? '';
      const providerRef = invoice.external_id ?? input.referenceId;
      if (providerSessionId.length === 0 || redirectUrl.length === 0) {
        throw new Error('Xendit invoice response was incomplete.');
      }
      return { providerRef, providerSessionId, redirectUrl };
    },
    async reconcileCheckoutSession(input: ReconcileCheckoutSessionInput): Promise<ParsedWebhookEvent | null> {
      const secretKey = resolveSecretKey(credentials);
      if (secretKey.length === 0 || input.providerSessionId.length === 0) {
        return null;
      }
      const response = await fetch(`${XENDIT_API_BASE}/v2/invoices/${encodeURIComponent(input.providerSessionId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}` },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        external_id?: string;
        status?: string;
        amount?: number;
      };
      if (!response.ok) {
        return null;
      }
      const status = payload.status?.toUpperCase() ?? '';
      const isPaid = status === 'PAID' || status === 'SETTLED';
      const isFailed = status === 'EXPIRED' || status === 'FAILED';
      if (!isPaid && !isFailed) {
        return null;
      }
      return {
        providerRef: payload.external_id ?? input.providerRef,
        providerSessionId: payload.id ?? input.providerSessionId,
        status: isPaid ? 'paid' : 'failed',
        amountCentavos: typeof payload.amount === 'number' ? payload.amount : undefined,
        raw: payload,
      };
    },
    parseWebhook(request: { readonly bodyText: string; readonly headers: Readonly<Record<string, string | undefined>> }): ParsedWebhookEvent | null {
      const expectedToken = (credentials.webhookToken ?? credentials.callbackToken ?? '').trim();
      if (expectedToken.length > 0) {
        const headerToken = request.headers['x-callback-token'] ?? request.headers['X-Callback-Token'];
        if (headerToken !== expectedToken) {
          return null;
        }
      }
      let json: unknown;
      try {
        json = JSON.parse(request.bodyText) as unknown;
      } catch {
        return null;
      }
      const body = json as {
        id?: string;
        external_id?: string;
        status?: string;
        amount?: number;
      };
      const status = body.status?.toUpperCase() ?? '';
      const isPaid = status === 'PAID' || status === 'SETTLED';
      const isFailed = status === 'EXPIRED' || status === 'FAILED';
      if (!isPaid && !isFailed) {
        return null;
      }
      return {
        providerRef: body.external_id ?? body.id ?? '',
        providerSessionId: body.id ?? '',
        status: isPaid ? 'paid' : 'failed',
        amountCentavos: typeof body.amount === 'number' ? body.amount : undefined,
        raw: json,
      };
    },
    async testConnection(): Promise<{ readonly ok: boolean; readonly message: string }> {
      const secretKey = resolveSecretKey(credentials);
      if (secretKey.length === 0) {
        return { ok: false, message: 'Missing Xendit secret key.' };
      }
      const response = await fetch(`${XENDIT_API_BASE}/balance`, {
        headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}` },
      });
      return response.ok
        ? { ok: true, message: 'Xendit credentials accepted.' }
        : { ok: false, message: `Xendit API returned ${response.status}.` };
    },
  };
}
