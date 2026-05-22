import type { PaymentGatewayId } from '@techmd/domain/payment-types';
import { VISITOR_SESSION_CONFIG } from '@techmd/domain/visitor-session';

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
  readonly quizSessionId: string;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  /**
   * Public site origin for PSP return URLs. Send the same value you pass as apiBaseUrl from native
   * so success redirects match openAuthSessionAsync’s return URL prefix.
   */
  readonly appBaseUrl?: string;
  /** Minimal HTML return route for in-app PSP browsers (Expo / ASWebAuthenticationSession). */
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string;
  /** Native anonymous visitor; must match checkout so GET /status can load the transaction. */
  readonly deviceId?: string | null;
  /** When set, visitor resolves to the signed-in account (must match checkout). */
  readonly marketingSessionToken?: string | null;
  readonly signal?: AbortSignal;
};

export type CreatePaymentCheckoutSessionResult = {
  readonly ok: true;
  readonly transactionId: string;
  readonly redirectUrl: string | null;
  readonly bookingId: string | null;
  readonly manualConfirm: boolean;
  readonly mock?: boolean;
  readonly bookingStatus: 'pending' | 'confirmed' | 'cancelled' | null;
};

function buildApiUrl(apiBaseUrl: string, path: string): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  return base.length === 0 ? path : `${base}${path}`;
}

function buildDeviceIdHeaders(deviceId: string | null | undefined): Record<string, string> {
  const trimmed = typeof deviceId === 'string' ? deviceId.trim() : '';
  if (trimmed.length === 0) {
    return {};
  }
  const value = trimmed.slice(0, VISITOR_SESSION_CONFIG.maxVisitorIdLength);
  return { [VISITOR_SESSION_CONFIG.mobileDeviceIdHeaderName]: value };
}

function buildMarketingAuthHeaders(marketingSessionToken: string | null | undefined): Record<string, string> {
  const token = marketingSessionToken?.trim() ?? '';
  if (token.length === 0) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export class PaymentConfigFetchError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'PaymentConfigFetchError';
    this.status = status;
    this.code = code;
  }
}

export function isPaymentConfigPromoInvalidError(error: unknown): error is PaymentConfigFetchError {
  return error instanceof PaymentConfigFetchError && error.code === 'promo_invalid';
}

export async function fetchPaymentConfigPublic(params: {
  readonly apiBaseUrl: string;
  readonly serviceKey?: string;
  readonly promoCode?: string;
  readonly signal?: AbortSignal;
}): Promise<PaymentConfigPublic> {
  const query = new URLSearchParams();
  const serviceKey = params.serviceKey?.trim() ?? '';
  if (serviceKey.length > 0) {
    query.set('serviceKey', serviceKey);
  }
  const promoCode = params.promoCode?.trim() ?? '';
  if (promoCode.length > 0) {
    query.set('promoCode', promoCode);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const url = buildApiUrl(params.apiBaseUrl, `/api/checkout/payment-config${suffix}`);
  const response = await fetch(url, { signal: params.signal, cache: 'no-store' });
  const payload = (await response.json()) as PaymentConfigPublic & { error?: string; code?: string };
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Failed to load payment config';
    throw new PaymentConfigFetchError(message, response.status, payload.code);
  }
  return payload;
}

export async function createPaymentCheckoutSession(
  params: CreatePaymentCheckoutSessionParams,
): Promise<CreatePaymentCheckoutSessionResult> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/payments/checkout-session');
  const body: Record<string, string | boolean> = {
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
  body.quizSessionId = params.quizSessionId;
  body.paymentMethodId = params.paymentMethodId;
  if (params.paymentMethodLabel !== undefined) {
    body.paymentMethodLabel = params.paymentMethodLabel;
  }
  const trimmedAppBase = params.appBaseUrl?.trim() ?? '';
  if (trimmedAppBase.length > 0) {
    body.appBaseUrl = trimmedAppBase;
  }
  if (params.nativeInAppPaymentReturn === true) {
    body.nativeInAppPaymentReturn = true;
  }
  const promoCode = params.promoCode?.trim() ?? '';
  if (promoCode.length > 0) {
    body.promoCode = promoCode;
  }
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...buildDeviceIdHeaders(params.deviceId),
      ...buildMarketingAuthHeaders(params.marketingSessionToken),
    },
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
  const rawBookingStatus = (payload as { bookingStatus?: unknown }).bookingStatus;
  const bookingStatus =
    rawBookingStatus === 'pending' || rawBookingStatus === 'confirmed' || rawBookingStatus === 'cancelled'
      ? rawBookingStatus
      : null;
  return {
    ok: true as const,
    transactionId: payload.transactionId,
    redirectUrl: payload.redirectUrl,
    bookingId: payload.bookingId,
    manualConfirm: payload.manualConfirm,
    mock: payload.mock,
    bookingStatus,
  };
}

export type PaymentTransactionStatusPayload = {
  readonly transactionId: string;
  readonly status: string;
  readonly bookingId: string | null;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodLabel: string | null;
  readonly amountCentavos: number | null;
  readonly amountLabel: string | null;
  readonly serviceKey: string | null;
  readonly startsAtIso: string | null;
  readonly timezone: string | null;
  readonly meetingUrl: string | null;
  readonly bookingStatus: 'pending' | 'confirmed' | 'cancelled' | null;
};

export async function fetchPaymentTransactionStatus(params: {
  readonly apiBaseUrl: string;
  readonly transactionId: string;
  readonly mock?: boolean;
  readonly deviceId?: string | null;
  readonly marketingSessionToken?: string | null;
  readonly signal?: AbortSignal;
}): Promise<PaymentTransactionStatusPayload> {
  const mockSuffix = params.mock === true ? '?mock=1' : '';
  const url = buildApiUrl(
    params.apiBaseUrl,
    `/api/payments/${encodeURIComponent(params.transactionId)}/status${mockSuffix}`,
  );
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      ...buildDeviceIdHeaders(params.deviceId),
      ...buildMarketingAuthHeaders(params.marketingSessionToken),
    },
    signal: params.signal,
    cache: 'no-store',
  });
  const payload = (await response.json()) as {
    transactionId?: string;
    status?: string;
    bookingId?: string | null;
    gatewayId?: PaymentGatewayId;
    paymentMethodLabel?: string | null;
    amountCentavos?: number;
    amountLabel?: string | null;
    serviceKey?: string | null;
    startsAtIso?: string | null;
    timezone?: string | null;
    meetingUrl?: string | null;
    bookingStatus?: string | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load payment status');
  }
  const meetingRaw = typeof payload.meetingUrl === 'string' ? payload.meetingUrl.trim() : '';
  const amountCentavos =
    typeof payload.amountCentavos === 'number' && Number.isFinite(payload.amountCentavos)
      ? payload.amountCentavos
      : null;
  const amountLabelRaw = typeof payload.amountLabel === 'string' ? payload.amountLabel.trim() : '';
  const serviceKeyRaw = typeof payload.serviceKey === 'string' ? payload.serviceKey.trim() : '';
  const rawBookingStatus = payload.bookingStatus;
  const bookingStatus =
    rawBookingStatus === 'pending' || rawBookingStatus === 'confirmed' || rawBookingStatus === 'cancelled'
      ? rawBookingStatus
      : null;
  return {
    transactionId: payload.transactionId ?? params.transactionId,
    status: payload.status ?? 'pending',
    bookingId: payload.bookingId ?? null,
    gatewayId: payload.gatewayId ?? 'paymongo',
    paymentMethodLabel: payload.paymentMethodLabel ?? null,
    amountCentavos,
    amountLabel: amountLabelRaw.length > 0 ? amountLabelRaw : null,
    serviceKey: serviceKeyRaw.length > 0 ? serviceKeyRaw : null,
    startsAtIso: payload.startsAtIso ?? null,
    timezone: payload.timezone ?? null,
    meetingUrl: meetingRaw.length > 0 ? meetingRaw : null,
    bookingStatus,
  };
}
