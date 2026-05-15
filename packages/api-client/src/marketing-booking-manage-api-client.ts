import type { PaymentGatewayId } from '@techmd/domain/payment-types';
import type { PaymentConfigPublic } from './marketing-payment-api-client.js';

export type GuestBookingManageView = {
  readonly bookingReference: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly customerName: string;
  readonly paymentPolicy: PaymentConfigPublic['paymentPolicy'];
  readonly paymentExpiresAtIso: string | null;
  readonly canPayOnline: boolean;
  readonly payBlockedReason: string | null;
  readonly checkoutAmountLabel: string;
  readonly paymentsEnabled: boolean;
};

export type GuestBookingManageCredentials = {
  readonly bookingReference: string;
  readonly email: string;
  readonly phoneLastFour: string;
};

function buildApiUrl(apiBaseUrl: string, path: string): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  return base.length === 0 ? path : `${base}${path}`;
}

export async function lookupGuestBooking(params: {
  readonly apiBaseUrl: string;
  readonly credentials: GuestBookingManageCredentials;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/manage/lookup');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.credentials),
    signal: params.signal,
  });
  const payload = (await response.json()) as { ok?: boolean; booking?: GuestBookingManageView; error?: string };
  if (!response.ok || payload.ok !== true || payload.booking === undefined) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Booking lookup failed.');
  }
  return payload.booking;
}

export async function createGuestBookingManageCheckout(params: {
  readonly apiBaseUrl: string;
  readonly credentials: GuestBookingManageCredentials;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl?: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly signal?: AbortSignal;
}): Promise<{
  readonly transactionId: string;
  readonly redirectUrl: string | null;
  readonly bookingId: string | null;
  readonly mock?: boolean;
}> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/manage/checkout');
  const body: Record<string, string | boolean> = {
    bookingReference: params.credentials.bookingReference,
    email: params.credentials.email,
    phoneLastFour: params.credentials.phoneLastFour,
    gatewayId: params.gatewayId,
    paymentMethodId: params.paymentMethodId,
  };
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
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: params.signal,
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    transactionId?: string;
    redirectUrl?: string | null;
    bookingId?: string | null;
    mock?: boolean;
    error?: string;
  };
  if (!response.ok || payload.ok !== true) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Checkout failed.');
  }
  return {
    transactionId: payload.transactionId ?? '',
    redirectUrl: payload.redirectUrl ?? null,
    bookingId: payload.bookingId ?? null,
    mock: payload.mock,
  };
}
