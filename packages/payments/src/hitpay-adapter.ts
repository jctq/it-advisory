import type {
  PaymentGatewayAdapter,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  ReconcileCheckoutSessionInput,
  GatewayCredentials,
} from './types';
import { resolveHitpayPaymentMethods } from './payment-method-types';
import { createHmac, timingSafeEqual } from 'node:crypto';

const HITPAY_API_BASE = 'https://api.hit-pay.com/v1';

function resolveApiKey(credentials: GatewayCredentials, sandboxMode: boolean): string {
  return sandboxMode
    ? (credentials.apiKeyTest ?? credentials.apiKey ?? '').trim()
    : (credentials.apiKeyLive ?? credentials.apiKey ?? '').trim();
}

export function createHitpayAdapter(credentials: GatewayCredentials): PaymentGatewayAdapter {
  return {
    gatewayId: 'hitpay',
    getCapabilities(): readonly string[] {
      return ['Card', 'GCash'];
    },
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
      const apiKey = resolveApiKey(credentials, input.sandboxMode);
      if (apiKey.length === 0) {
        throw new Error('HitPay API key is not configured.');
      }
      const amount = (input.amountCentavos / 100).toFixed(2);
      const body = new URLSearchParams();
      body.set('amount', amount);
      body.set('currency', input.currency);
      body.set('redirect_url', input.successUrl);
      body.set('reference_number', input.referenceId);
      body.set('purpose', input.description);
      const customerName = input.customerName?.trim() ?? '';
      const customerEmail = input.customerEmail?.trim() ?? '';
      const customerPhone = input.customerPhone?.trim() ?? '';
      if (customerName.length > 0) {
        body.set('name', customerName);
      }
      if (customerEmail.length > 0) {
        body.set('email', customerEmail);
      }
      if (customerPhone.length > 0) {
        body.set('phone', customerPhone);
      }
      for (const method of resolveHitpayPaymentMethods(input.paymentMethodId)) {
        body.append('payment_methods[]', method);
      }
      const response = await fetch(`${HITPAY_API_BASE}/payment-requests`, {
        method: 'POST',
        headers: {
          'X-BUSINESS-API-KEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload === 'object' ? JSON.stringify(payload) : `HitPay HTTP ${response.status}`);
      }
      const row = payload as { id?: string; url?: string; reference_number?: string };
      const providerSessionId = row.id ?? '';
      const redirectUrl = row.url ?? '';
      const providerRef = row.reference_number ?? input.referenceId;
      if (providerSessionId.length === 0 || redirectUrl.length === 0) {
        throw new Error('HitPay payment request response was incomplete.');
      }
      return { providerRef, providerSessionId, redirectUrl };
    },
    async reconcileCheckoutSession(input: ReconcileCheckoutSessionInput): Promise<ParsedWebhookEvent | null> {
      const apiKey = resolveApiKey(credentials, input.sandboxMode);
      if (apiKey.length === 0 || input.providerSessionId.length === 0) {
        return null;
      }
      const response = await fetch(
        `${HITPAY_API_BASE}/payment-requests/${encodeURIComponent(input.providerSessionId)}`,
        { headers: { 'X-BUSINESS-API-KEY': apiKey } },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        reference_number?: string;
        status?: string;
        amount?: string;
      };
      if (!response.ok) {
        return null;
      }
      const status = payload.status?.toLowerCase() ?? '';
      const isPaid = status === 'completed';
      const isFailed = status === 'failed' || status === 'expired';
      if (!isPaid && !isFailed) {
        return null;
      }
      const amountCentavos =
        typeof payload.amount === 'string' ? Math.round(Number.parseFloat(payload.amount) * 100) : undefined;
      return {
        providerRef: payload.reference_number ?? input.providerRef,
        providerSessionId: payload.id ?? input.providerSessionId,
        status: isPaid ? 'paid' : 'failed',
        amountCentavos: Number.isFinite(amountCentavos) ? amountCentavos : undefined,
        raw: payload,
      };
    },
    parseWebhook(request: { readonly bodyText: string; readonly headers: Readonly<Record<string, string | undefined>> }): ParsedWebhookEvent | null {
      const salt = (credentials.salt ?? credentials.webhookSecret ?? '').trim();
      if (salt.length > 0) {
        const signature = request.headers['hitpay-signature'] ?? request.headers['Hitpay-Signature'];
        if (typeof signature !== 'string' || !verifyHitpaySignature(request.bodyText, signature, salt)) {
          return null;
        }
      }
      let json: unknown;
      try {
        json = JSON.parse(request.bodyText) as unknown;
      } catch {
        return null;
      }
      const body = json as { payment_request_id?: string; reference_number?: string; status?: string; amount?: string };
      const status = body.status?.toLowerCase() ?? '';
      const isPaid = status === 'completed';
      const isFailed = status === 'failed' || status === 'expired';
      if (!isPaid && !isFailed) {
        return null;
      }
      const amountCentavos =
        typeof body.amount === 'string' ? Math.round(Number.parseFloat(body.amount) * 100) : undefined;
      return {
        providerRef: body.reference_number ?? body.payment_request_id ?? '',
        providerSessionId: body.payment_request_id ?? '',
        status: isPaid ? 'paid' : 'failed',
        amountCentavos: Number.isFinite(amountCentavos) ? amountCentavos : undefined,
        raw: json,
      };
    },
    async testConnection(): Promise<{ readonly ok: boolean; readonly message: string }> {
      const apiKey = resolveApiKey(credentials, true);
      if (apiKey.length === 0) {
        return { ok: false, message: 'Missing HitPay API key.' };
      }
      return { ok: true, message: 'HitPay credentials present (no lightweight ping endpoint).' };
    },
  };
}

function verifyHitpaySignature(bodyText: string, signature: string, salt: string): boolean {
  const expected = createHmac('sha256', salt).update(bodyText).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
