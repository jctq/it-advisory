import type {
  PaymentGatewayAdapter,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  ReconcileCheckoutSessionInput,
  GatewayCredentials,
} from './types';
import { buildPaymongoBilling } from './customer-prefill';
import { resolvePaymongoPaymentMethodTypes } from './payment-method-types';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';

function resolveSecretKey(credentials: GatewayCredentials, sandboxMode: boolean): string {
  const key = sandboxMode
    ? (credentials.secretKeyTest ?? credentials.secretKey ?? '')
    : (credentials.secretKeyLive ?? credentials.secretKey ?? '');
  return key.trim();
}

function encodeBasicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export function createPaymongoAdapter(credentials: GatewayCredentials): PaymentGatewayAdapter {
  return {
    gatewayId: 'paymongo',
    getCapabilities(): readonly string[] {
      return ['Card', 'GCash', 'Maya'];
    },
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
      const secretKey = resolveSecretKey(credentials, input.sandboxMode);
      if (secretKey.length === 0) {
        throw new Error('PayMongo secret key is not configured.');
      }
      const billing = buildPaymongoBilling(input);
      const paymentMethodTypes = [...resolvePaymongoPaymentMethodTypes(input.paymentMethodId)];
      const response = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
        method: 'POST',
        headers: {
          Authorization: encodeBasicAuth(secretKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            attributes: {
              line_items: [
                {
                  amount: input.amountCentavos,
                  currency: input.currency,
                  name: input.description,
                  quantity: 1,
                },
              ],
              payment_method_types: paymentMethodTypes,
              ...(billing !== undefined ? { billing } : {}),
              success_url: input.successUrl,
              cancel_url: input.cancelUrl,
              description: input.description,
              reference_number: input.referenceId,
              metadata: input.metadata,
            },
          },
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'errors' in payload &&
          Array.isArray((payload as { errors: unknown }).errors)
            ? JSON.stringify((payload as { errors: unknown }).errors)
            : `PayMongo HTTP ${response.status}`;
        throw new Error(message);
      }
      const data =
        typeof payload === 'object' && payload !== null && 'data' in payload
          ? (payload as { data: { id?: string; attributes?: { checkout_url?: string; reference_number?: string } } }).data
          : null;
      const providerSessionId = data?.id ?? '';
      const redirectUrl = data?.attributes?.checkout_url ?? '';
      const providerRef = data?.attributes?.reference_number ?? input.referenceId;
      if (providerSessionId.length === 0 || redirectUrl.length === 0) {
        throw new Error('PayMongo checkout session response was incomplete.');
      }
      return { providerRef, providerSessionId, redirectUrl };
    },
    async reconcileCheckoutSession(input: ReconcileCheckoutSessionInput): Promise<ParsedWebhookEvent | null> {
      const secretKey = resolveSecretKey(credentials, input.sandboxMode);
      if (secretKey.length === 0 || input.providerSessionId.length === 0) {
        return null;
      }
      const response = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions/${encodeURIComponent(input.providerSessionId)}`, {
        headers: { Authorization: encodeBasicAuth(secretKey) },
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        return null;
      }
      return parsePaymongoCheckoutSessionPayload(payload, input);
    },
    parseWebhook(request: { readonly bodyText: string; readonly headers: Readonly<Record<string, string | undefined>> }): ParsedWebhookEvent | null {
      const webhookSecret = (credentials.webhookSecret ?? credentials.webhookSecretLive ?? '').trim();
      if (webhookSecret.length > 0) {
        const signatureHeader = request.headers['paymongo-signature'] ?? request.headers['Paymongo-Signature'];
        if (typeof signatureHeader !== 'string' || !verifyPaymongoSignature(request.bodyText, signatureHeader, webhookSecret)) {
          return null;
        }
      }
      let json: unknown;
      try {
        json = JSON.parse(request.bodyText) as unknown;
      } catch {
        return null;
      }
      const eventType =
        typeof json === 'object' && json !== null && 'data' in json
          ? (json as { data?: { attributes?: { type?: string } } }).data?.attributes?.type
          : undefined;
      const resource =
        typeof json === 'object' && json !== null && 'data' in json
          ? (json as { data?: { attributes?: { data?: { id?: string; attributes?: { amount?: number; metadata?: Record<string, string>; reference_number?: string } } } } })
              .data?.attributes?.data
          : undefined;
      const providerSessionId = resource?.id ?? '';
      const providerRef = resource?.attributes?.reference_number ?? resource?.attributes?.metadata?.referenceId ?? providerSessionId;
      const amountCentavos = resource?.attributes?.amount;
      const isPaid = eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid';
      const isFailed = eventType === 'checkout_session.payment.failed' || eventType === 'payment.failed';
      if (!isPaid && !isFailed) {
        return null;
      }
      return {
        providerRef,
        providerSessionId,
        status: isPaid ? 'paid' : 'failed',
        amountCentavos: typeof amountCentavos === 'number' ? amountCentavos : undefined,
        raw: json,
      };
    },
    async testConnection(): Promise<{ readonly ok: boolean; readonly message: string }> {
      const secretKey = resolveSecretKey(credentials, true);
      if (secretKey.length === 0) {
        return { ok: false, message: 'Missing PayMongo secret key.' };
      }
      const response = await fetch(`${PAYMONGO_API_BASE}/webhooks`, {
        headers: { Authorization: encodeBasicAuth(secretKey) },
      });
      if (response.ok) {
        return { ok: true, message: 'PayMongo credentials accepted.' };
      }
      return { ok: false, message: `PayMongo API returned ${response.status}.` };
    },
  };
}

function parsePaymongoCheckoutSessionPayload(
  payload: unknown,
  input: ReconcileCheckoutSessionInput,
): ParsedWebhookEvent | null {
  const data =
    typeof payload === 'object' && payload !== null && 'data' in payload
      ? (payload as { data?: { id?: string; attributes?: PaymongoCheckoutAttributes } }).data
      : null;
  if (data === null || data === undefined) {
    return null;
  }
  const providerSessionId = data.id ?? input.providerSessionId;
  const providerRef = data.attributes?.reference_number ?? input.providerRef;
  const payments = data.attributes?.payments ?? [];
  for (const payment of payments) {
    const paymentStatus = payment.attributes?.status?.toLowerCase() ?? '';
    if (paymentStatus === 'paid') {
      return {
        providerRef,
        providerSessionId,
        status: 'paid',
        amountCentavos: payment.attributes?.amount,
        raw: payload,
      };
    }
    if (paymentStatus === 'failed') {
      return {
        providerRef,
        providerSessionId,
        status: 'failed',
        amountCentavos: payment.attributes?.amount,
        raw: payload,
      };
    }
  }
  const paymentIntentStatus = data.attributes?.payment_intent?.attributes?.status?.toLowerCase() ?? '';
  if (paymentIntentStatus === 'succeeded') {
    const amountCentavos = data.attributes?.payment_intent?.attributes?.amount;
    return {
      providerRef,
      providerSessionId,
      status: 'paid',
      amountCentavos: typeof amountCentavos === 'number' ? amountCentavos : undefined,
      raw: payload,
    };
  }
  if (data.attributes?.status === 'expired') {
    return { providerRef, providerSessionId, status: 'expired', raw: payload };
  }
  return null;
}

type PaymongoCheckoutAttributes = {
  readonly reference_number?: string;
  readonly status?: string;
  readonly payments?: readonly {
    readonly attributes?: { readonly status?: string; readonly amount?: number };
  }[];
  readonly payment_intent?: {
    readonly attributes?: { readonly status?: string; readonly amount?: number };
  };
};

function verifyPaymongoSignature(bodyText: string, signatureHeader: string, webhookSecret: string): boolean {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signaturePart = parts.find((part) => part.startsWith('te=') || part.startsWith('li='));
  if (timestampPart === undefined || signaturePart === undefined) {
    return false;
  }
  const timestamp = timestampPart.slice(2);
  const signature = signaturePart.split('=')[1] ?? '';
  const payload = `${timestamp}.${bodyText}`;
  const expected = createHmac('sha256', webhookSecret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
