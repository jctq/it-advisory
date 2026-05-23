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

const PAYMONGO_API_V1 = 'https://api.paymongo.com/v1';
const PAYMONGO_CHECKOUT_API = 'https://api.paymongo.com/v2';

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
      return ['Card', 'GCash', 'Maya', 'GrabPay', 'ShopeePay'];
    },
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
      const secretKey = resolveSecretKey(credentials, input.sandboxMode);
      if (secretKey.length === 0) {
        throw new Error('PayMongo secret key is not configured.');
      }
      const billing = buildPaymongoBilling(input);
      const paymentMethodTypes = [...resolvePaymongoPaymentMethodTypes(input.paymentMethodId)];
      const response = await fetch(`${PAYMONGO_CHECKOUT_API}/checkout_sessions`, {
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
      // Hosted Checkout is created on v2, but status retrieval is only exposed on v1.
      const response = await fetch(
        `${PAYMONGO_API_V1}/checkout_sessions/${encodeURIComponent(input.providerSessionId)}`,
        { headers: { Authorization: encodeBasicAuth(secretKey) } },
      );
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
      const eventType = resolvePaymongoWebhookEventType(json);
      const checkoutSession = resolvePaymongoWebhookCheckoutSession(json);
      const isPaid = eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid';
      const isFailed = eventType === 'checkout_session.payment.failed' || eventType === 'payment.failed';
      if (!isPaid && !isFailed) {
        return null;
      }
      const nextStatus = isPaid ? 'paid' : 'failed';
      if (checkoutSession !== null) {
        const fromSession = parsePaymongoCheckoutSessionPayload({ data: checkoutSession }, {
          providerSessionId: checkoutSession.id ?? '',
          providerRef:
            checkoutSession.attributes?.reference_number ??
            checkoutSession.attributes?.metadata?.referenceId ??
            checkoutSession.id ??
            '',
          sandboxMode: true,
        });
        if (fromSession !== null) {
          return { ...fromSession, status: nextStatus, raw: json };
        }
        const providerSessionId = checkoutSession.id?.trim() ?? '';
        if (providerSessionId.length > 0) {
          const providerRef =
            checkoutSession.attributes?.reference_number ??
            checkoutSession.attributes?.metadata?.referenceId ??
            providerSessionId;
          return {
            providerRef,
            providerSessionId,
            status: nextStatus,
            raw: json,
          };
        }
      }
      return null;
    },
    async testConnection(): Promise<{ readonly ok: boolean; readonly message: string }> {
      const secretKey = resolveSecretKey(credentials, true);
      if (secretKey.length === 0) {
        return { ok: false, message: 'Missing PayMongo secret key.' };
      }
      const response = await fetch(`${PAYMONGO_API_V1}/webhooks`, {
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
      ? (payload as { data?: PaymongoCheckoutSessionResource }).data
      : null;
  if (data === null || data === undefined) {
    return null;
  }
  const providerSessionId = data.id ?? input.providerSessionId;
  const providerRef = data.attributes?.reference_number ?? input.providerRef;
  const payments = data.attributes?.payments ?? [];
  for (const payment of payments) {
    const paymentStatus = resolvePaymongoPaymentStatus(payment);
    if (paymentStatus === 'paid' || paymentStatus === 'succeeded') {
      return {
        providerRef,
        providerSessionId,
        status: 'paid',
        amountCentavos: resolvePaymongoPaymentAmount(payment),
        raw: payload,
      };
    }
    if (paymentStatus === 'failed') {
      return {
        providerRef,
        providerSessionId,
        status: 'failed',
        amountCentavos: resolvePaymongoPaymentAmount(payment),
        raw: payload,
      };
    }
  }
  const paidAt = data.attributes?.paid_at;
  if (typeof paidAt === 'number' && paidAt > 0) {
    const amountCentavos = data.attributes?.payment_intent?.attributes?.amount;
    return {
      providerRef,
      providerSessionId,
      status: 'paid',
      amountCentavos: typeof amountCentavos === 'number' ? amountCentavos : undefined,
      raw: payload,
    };
  }
  const paymentIntentStatus = data.attributes?.payment_intent?.attributes?.status?.toLowerCase() ?? '';
  if (paymentIntentStatus === 'succeeded' || paymentIntentStatus === 'paid') {
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

/** @internal Exported for unit tests only. */
export function parsePaymongoCheckoutSessionPayloadForTest(
  payload: unknown,
  input: ReconcileCheckoutSessionInput,
): ParsedWebhookEvent | null {
  return parsePaymongoCheckoutSessionPayload(payload, input);
}

type PaymongoCheckoutSessionResource = {
  readonly id?: string;
  readonly attributes?: PaymongoCheckoutAttributes;
};

type PaymongoCheckoutAttributes = {
  readonly reference_number?: string;
  readonly status?: string;
  readonly paid_at?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly payments?: readonly PaymongoPaymentResource[];
  readonly payment_intent?: {
    readonly attributes?: { readonly status?: string; readonly amount?: number };
  };
};

type PaymongoPaymentResource = {
  readonly status?: string;
  readonly attributes?: { readonly status?: string; readonly amount?: number };
};

function resolvePaymongoPaymentStatus(payment: PaymongoPaymentResource): string {
  const raw = payment.attributes?.status ?? payment.status ?? '';
  return raw.trim().toLowerCase();
}

function resolvePaymongoPaymentAmount(payment: PaymongoPaymentResource): number | undefined {
  const amount = payment.attributes?.amount;
  return typeof amount === 'number' ? amount : undefined;
}

function resolvePaymongoWebhookEventType(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null || !('data' in json)) {
    return undefined;
  }
  const data = (json as { data?: PaymongoWebhookEnvelope }).data;
  if (data === undefined) {
    return undefined;
  }
  const directType = data.type?.trim() ?? '';
  const legacyType = data.attributes?.type?.trim() ?? '';
  if (legacyType.length > 0 && isPaymongoWebhookEnvelopeType(directType)) {
    return legacyType;
  }
  if (directType.length > 0) {
    return directType;
  }
  return legacyType.length > 0 ? legacyType : undefined;
}

function isPaymongoWebhookEnvelopeType(type: string): boolean {
  return type === 'event' || type === 'send.webhook';
}

function resolvePaymongoWebhookCheckoutSession(json: unknown): PaymongoCheckoutSessionResource | null {
  if (typeof json !== 'object' || json === null || !('data' in json)) {
    return null;
  }
  const data = (json as { data?: PaymongoWebhookEnvelope }).data;
  if (data === undefined) {
    return null;
  }
  const directSession = data.data;
  if (directSession !== undefined && typeof directSession.id === 'string') {
    return directSession;
  }
  const legacySession = data.attributes?.data;
  if (legacySession !== undefined && typeof legacySession.id === 'string') {
    return legacySession;
  }
  return null;
}

type PaymongoWebhookEnvelope = {
  readonly type?: string;
  readonly data?: PaymongoCheckoutSessionResource;
  readonly attributes?: {
    readonly type?: string;
    readonly data?: PaymongoCheckoutSessionResource;
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
