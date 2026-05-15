import type { PaymentGatewayId } from '@it-advisory/domain/payment-types';

export type PaymentConfigPublic = {
  readonly paymentsEnabled: boolean;
  readonly paymentPolicy: 'pay_before_booking' | 'pay_after_hold' | 'manual_confirm';
  readonly currency: 'PHP';
  readonly checkoutAmountCentavos: number;
  readonly checkoutAmountLabel: string;
  readonly holdExpiresMinutes: number;
  readonly sandboxMode: boolean;
  readonly gateways: readonly {
    readonly id: PaymentGatewayId;
    readonly label: string;
    readonly description: string;
    readonly methodLabels: readonly string[];
    readonly methods: readonly {
      readonly id: string;
      readonly label: string;
      readonly hint: string;
    }[];
  }[];
};

export type CreatePaymentCheckoutSessionParams = {
  readonly apiBaseUrl: string;
  readonly gatewayId: PaymentGatewayId;
  readonly date: string;
  readonly time: string;
  readonly serviceKey?: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerCompany?: string;
  readonly customerPhone: string;
  readonly quizSessionId?: string;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly signal?: AbortSignal;
};

export type CreatePaymentCheckoutSessionResult = {
  readonly ok: true;
  readonly transactionId: string;
  readonly redirectUrl: string | null;
  readonly bookingId: string | null;
  readonly manualConfirm: boolean;
  readonly mock?: boolean;
};

function buildApiUrl(apiBaseUrl: string, path: string): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  return base.length === 0 ? path : `${base}${path}`;
}

export async function fetchPaymentConfigPublic(params: {
  readonly apiBaseUrl: string;
  readonly signal?: AbortSignal;
}): Promise<PaymentConfigPublic> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/checkout/payment-config');
  const response = await fetch(url, { signal: params.signal, cache: 'no-store' });
  const payload = (await response.json()) as PaymentConfigPublic & { error?: string };
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load payment config');
  }
  return payload;
}

export async function createPaymentCheckoutSession(
  params: CreatePaymentCheckoutSessionParams,
): Promise<CreatePaymentCheckoutSessionResult> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/payments/checkout-session');
  const body: Record<string, string> = {
    gatewayId: params.gatewayId,
    date: params.date,
    time: params.time,
    serviceKey: params.serviceKey ?? 'project-rescue',
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
  };
  if (params.customerCompany !== undefined && params.customerCompany.trim().length > 0) {
    body.customerCompany = params.customerCompany.trim();
  }
  if (params.quizSessionId !== undefined && params.quizSessionId.length > 0) {
    body.quizSessionId = params.quizSessionId;
  }
  body.paymentMethodId = params.paymentMethodId;
  if (params.paymentMethodLabel !== undefined) {
    body.paymentMethodLabel = params.paymentMethodLabel;
  }
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: params.signal,
  });
  const payload = (await response.json()) as CreatePaymentCheckoutSessionResult & {
    ok?: boolean;
    error?: string;
    code?: string;
  };
  if (!response.ok || payload.ok !== true) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Checkout session failed');
  }
  return payload;
}

export async function fetchPaymentTransactionStatus(params: {
  readonly apiBaseUrl: string;
  readonly transactionId: string;
  readonly mock?: boolean;
  readonly signal?: AbortSignal;
}): Promise<{
  readonly transactionId: string;
  readonly status: string;
  readonly bookingId: string | null;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodLabel: string | null;
  readonly startsAtIso: string | null;
  readonly timezone: string | null;
}> {
  const mockSuffix = params.mock === true ? '?mock=1' : '';
  const url = buildApiUrl(
    params.apiBaseUrl,
    `/api/payments/${encodeURIComponent(params.transactionId)}/status${mockSuffix}`,
  );
  const response = await fetch(url, { credentials: 'include', signal: params.signal, cache: 'no-store' });
  const payload = (await response.json()) as {
    transactionId?: string;
    status?: string;
    bookingId?: string | null;
    gatewayId?: PaymentGatewayId;
    paymentMethodLabel?: string | null;
    startsAtIso?: string | null;
    timezone?: string | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load payment status');
  }
  return {
    transactionId: payload.transactionId ?? params.transactionId,
    status: payload.status ?? 'pending',
    bookingId: payload.bookingId ?? null,
    gatewayId: payload.gatewayId ?? 'paymongo',
    paymentMethodLabel: payload.paymentMethodLabel ?? null,
    startsAtIso: payload.startsAtIso ?? null,
    timezone: payload.timezone ?? null,
  };
}
