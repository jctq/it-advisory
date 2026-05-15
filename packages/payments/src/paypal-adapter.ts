import type {
  PaymentGatewayAdapter,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  ReconcileCheckoutSessionInput,
  GatewayCredentials,
} from './types';
import { splitCustomerName } from './customer-prefill';

function resolveBaseUrl(sandboxMode: boolean): string {
  return sandboxMode ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

async function fetchPaypalAccessToken(clientId: string, clientSecret: string, sandboxMode: boolean): Promise<string> {
  const response = await fetch(`${resolveBaseUrl(sandboxMode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok || typeof payload.access_token !== 'string') {
    throw new Error('PayPal authentication failed.');
  }
  return payload.access_token;
}

type PaypalOrderPayload = {
  readonly id?: string;
  readonly status?: string;
  readonly purchase_units?: readonly {
    readonly reference_id?: string;
    readonly custom_id?: string;
    readonly amount?: { readonly value?: string };
  }[];
};

async function fetchPaypalOrder(
  accessToken: string,
  sandboxMode: boolean,
  orderId: string,
): Promise<PaypalOrderPayload | null> {
  const response = await fetch(
    `${resolveBaseUrl(sandboxMode)}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = (await response.json().catch(() => ({}))) as PaypalOrderPayload;
  if (!response.ok) {
    return null;
  }
  return payload;
}

async function capturePaypalOrder(
  accessToken: string,
  sandboxMode: boolean,
  orderId: string,
): Promise<PaypalOrderPayload | null> {
  const response = await fetch(
    `${resolveBaseUrl(sandboxMode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const payload = (await response.json().catch(() => ({}))) as PaypalOrderPayload;
  if (!response.ok) {
    return null;
  }
  return payload;
}

function parsePaypalOrderToEvent(
  payload: PaypalOrderPayload,
  input: ReconcileCheckoutSessionInput,
): ParsedWebhookEvent | null {
  const orderStatus = payload.status?.toUpperCase() ?? '';
  const isPaid = orderStatus === 'COMPLETED';
  const isFailed = orderStatus === 'VOIDED' || orderStatus === 'CANCELLED';
  if (!isPaid && !isFailed) {
    return null;
  }
  const amountValue = payload.purchase_units?.[0]?.amount?.value;
  const amountCentavos =
    typeof amountValue === 'string' ? Math.round(Number.parseFloat(amountValue) * 100) : undefined;
  const providerRef =
    payload.purchase_units?.[0]?.custom_id ??
    payload.purchase_units?.[0]?.reference_id ??
    input.providerRef;
  return {
    providerRef,
    providerSessionId: payload.id ?? input.providerSessionId,
    status: isPaid ? 'paid' : 'failed',
    amountCentavos: Number.isFinite(amountCentavos) ? amountCentavos : undefined,
    raw: payload,
  };
}

export function createPaypalAdapter(credentials: GatewayCredentials): PaymentGatewayAdapter {
  return {
    gatewayId: 'paypal',
    getCapabilities(): readonly string[] {
      return ['PayPal'];
    },
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
      const clientId = (credentials.clientId ?? '').trim();
      const clientSecret = (credentials.clientSecret ?? '').trim();
      if (clientId.length === 0 || clientSecret.length === 0) {
        throw new Error('PayPal client ID and secret are not configured.');
      }
      const accessToken = await fetchPaypalAccessToken(clientId, clientSecret, input.sandboxMode);
      const amount = (input.amountCentavos / 100).toFixed(2);
      const customerEmail = input.customerEmail?.trim() ?? '';
      const customerName = input.customerName?.trim() ?? '';
      const customerPhone = input.customerPhone?.trim() ?? '';
      const payer =
        customerEmail.length > 0 || customerName.length > 0 || customerPhone.length > 0
          ? {
              ...(customerEmail.length > 0 ? { email_address: customerEmail } : {}),
              ...(customerName.length > 0
                ? (() => {
                    const { givenNames, surname } = splitCustomerName(customerName);
                    return { name: { given_name: givenNames, surname } };
                  })()
                : {}),
              ...(customerPhone.length > 0
                ? {
                    phone: {
                      phone_type: 'MOBILE',
                      phone_number: { national_number: customerPhone.replace(/\D/g, '') },
                    },
                  }
                : {}),
            }
          : undefined;
      const response = await fetch(`${resolveBaseUrl(input.sandboxMode)}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          ...(payer !== undefined ? { payer } : {}),
          purchase_units: [
            {
              reference_id: input.referenceId,
              description: input.description,
              amount: { currency_code: input.currency, value: amount },
              custom_id: input.referenceId,
            },
          ],
          application_context: {
            return_url: input.successUrl,
            cancel_url: input.cancelUrl,
            user_action: 'PAY_NOW',
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        links?: readonly { rel?: string; href?: string }[];
      };
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      const approveLink = payload.links?.find((link) => link.rel === 'approve');
      const providerSessionId = payload.id ?? '';
      const redirectUrl = approveLink?.href ?? '';
      if (providerSessionId.length === 0 || redirectUrl.length === 0) {
        throw new Error('PayPal order response was incomplete.');
      }
      return { providerRef: input.referenceId, providerSessionId, redirectUrl };
    },
    async reconcileCheckoutSession(input: ReconcileCheckoutSessionInput): Promise<ParsedWebhookEvent | null> {
      const clientId = (credentials.clientId ?? '').trim();
      const clientSecret = (credentials.clientSecret ?? '').trim();
      if (clientId.length === 0 || clientSecret.length === 0 || input.providerSessionId.length === 0) {
        return null;
      }
      const accessToken = await fetchPaypalAccessToken(clientId, clientSecret, input.sandboxMode);
      let order = await fetchPaypalOrder(accessToken, input.sandboxMode, input.providerSessionId);
      if (order === null) {
        return null;
      }
      const orderStatus = order.status?.toUpperCase() ?? '';
      if (orderStatus === 'APPROVED') {
        const captured = await capturePaypalOrder(accessToken, input.sandboxMode, input.providerSessionId);
        if (captured !== null) {
          order = captured;
        } else {
          const refreshed = await fetchPaypalOrder(accessToken, input.sandboxMode, input.providerSessionId);
          if (refreshed !== null) {
            order = refreshed;
          }
        }
      }
      return parsePaypalOrderToEvent(order, input);
    },
    parseWebhook(request: { readonly bodyText: string }): ParsedWebhookEvent | null {
      let json: unknown;
      try {
        json = JSON.parse(request.bodyText) as unknown;
      } catch {
        return null;
      }
      const body = json as {
        event_type?: string;
        resource?: {
          id?: string;
          custom_id?: string;
          amount?: { value?: string };
          supplementary_data?: { related_ids?: { order_id?: string } };
        };
      };
      const eventType = body.event_type ?? '';
      const isPaid =
        eventType === 'CHECKOUT.ORDER.COMPLETED' || eventType === 'PAYMENT.CAPTURE.COMPLETED';
      const isFailed = eventType === 'CHECKOUT.ORDER.VOIDED' || eventType === 'PAYMENT.CAPTURE.DENIED';
      if (!isPaid && !isFailed) {
        return null;
      }
      const amountValue = body.resource?.amount?.value;
      const amountCentavos =
        typeof amountValue === 'string' ? Math.round(Number.parseFloat(amountValue) * 100) : undefined;
      const providerSessionId =
        body.resource?.supplementary_data?.related_ids?.order_id ?? body.resource?.id ?? '';
      return {
        providerRef: body.resource?.custom_id ?? providerSessionId,
        providerSessionId,
        status: isPaid ? 'paid' : 'failed',
        amountCentavos: Number.isFinite(amountCentavos) ? amountCentavos : undefined,
        raw: json,
      };
    },
    async testConnection(): Promise<{ readonly ok: boolean; readonly message: string }> {
      const clientId = (credentials.clientId ?? '').trim();
      const clientSecret = (credentials.clientSecret ?? '').trim();
      if (clientId.length === 0 || clientSecret.length === 0) {
        return { ok: false, message: 'Missing PayPal client credentials.' };
      }
      try {
        await fetchPaypalAccessToken(clientId, clientSecret, true);
        return { ok: true, message: 'PayPal sandbox credentials accepted.' };
      } catch (error: unknown) {
        return { ok: false, message: error instanceof Error ? error.message : 'PayPal test failed.' };
      }
    },
  };
}
