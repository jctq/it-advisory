import type { PaymentGatewayId } from '@techmd/domain/payment-types';
import type { PaymentConfigPublic } from './marketing-payment-api-client.js';

export type BookingPayGuidanceAction = {
  readonly label: string;
  readonly href: string;
};

export type BookingPayGuidance = {
  readonly title: string;
  readonly message: string;
  readonly steps: readonly string[];
  readonly actions: readonly BookingPayGuidanceAction[];
};

export type GuestBookingManageView = {
  readonly bookingReference: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly customerName: string;
  readonly paymentPolicy: PaymentConfigPublic['paymentPolicy'];
  readonly paymentExpiresAtIso: string | null;
  readonly canPayOnline: boolean;
  readonly payBlockedReason: string | null;
  readonly payGuidance: BookingPayGuidance | null;
  readonly profileSyncAvailable: boolean;
  readonly overduePendingActionsAvailable: boolean;
  readonly quizSessionMarketingRef: string | null;
  readonly payabilityCode: string;
  readonly checkoutAmountLabel: string;
  readonly paymentsEnabled: boolean;
  readonly recordingOptIn: boolean;
  readonly fathomNotesUrl: string | null;
  readonly fathomSummaryPreview: string | null;
  readonly sessionEndedAtIso: string | null;
  readonly sessionTitle: string | null;
  readonly serviceTitle: string;
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

type SessionLookupPayload = {
  readonly ok?: boolean;
  readonly booking?: GuestBookingManageView;
  readonly error?: string;
  readonly code?: string;
};

export class BookingSessionLookupError extends Error {
  readonly statusCode: number;
  readonly code: string | null;

  constructor(message: string, statusCode: number, code: string | null) {
    super(message);
    this.name = 'BookingSessionLookupError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function parseSessionLookupResponse(response: Response): Promise<GuestBookingManageView> {
  const payload = (await response.json()) as SessionLookupPayload;
  if (response.ok && payload.ok === true && payload.booking !== undefined) {
    return payload.booking;
  }
  const message = typeof payload.error === 'string' ? payload.error : 'Booking lookup failed.';
  const code = typeof payload.code === 'string' ? payload.code : null;
  throw new BookingSessionLookupError(message, response.status, code);
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

export async function lookupGuestBookingSession(params: {
  readonly apiBaseUrl: string;
  readonly credentials: GuestBookingManageCredentials;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/session/lookup');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.credentials),
    signal: params.signal,
  });
  return parseSessionLookupResponse(response);
}

export async function lookupAccountBookingSession(params: {
  readonly apiBaseUrl: string;
  readonly bookingId: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/session/lookup-account');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: params.bookingId }),
    signal: params.signal,
  });
  return parseSessionLookupResponse(response);
}

export async function lookupAccountBookingSessionByReference(params: {
  readonly apiBaseUrl: string;
  readonly bookingReference: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/session/lookup-account-by-reference');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference: params.bookingReference }),
    signal: params.signal,
  });
  return parseSessionLookupResponse(response);
}

export async function lookupGuestBookingSessionByToken(params: {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/session/lookup-token');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: params.token }),
    signal: params.signal,
  });
  return parseSessionLookupResponse(response);
}

export async function syncAccountProfileToManagedBooking(params: {
  readonly apiBaseUrl: string;
  readonly bookingId: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/manage/sync-profile-account');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: params.bookingId }),
    signal: params.signal,
  });
  const payload = (await response.json()) as { ok?: boolean; booking?: GuestBookingManageView; error?: string };
  if (!response.ok || payload.ok !== true || payload.booking === undefined) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Profile sync failed.');
  }
  return payload.booking;
}

export async function lookupAccountManagedBooking(params: {
  readonly apiBaseUrl: string;
  readonly bookingId: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/manage/lookup-account');
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: params.bookingId }),
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
    payabilityCode?: string;
    debug?: Record<string, unknown>;
  };
  if (!response.ok || payload.ok !== true) {
    const error = new Error(typeof payload.error === 'string' ? payload.error : 'Checkout failed.');
    if (typeof payload.payabilityCode === 'string') {
      (error as Error & { payabilityCode: string }).payabilityCode = payload.payabilityCode;
    }
    if (payload.debug !== undefined) {
      (error as Error & { payabilityDebug: Record<string, unknown> }).payabilityDebug = payload.debug;
    }
    throw error;
  }
  return {
    transactionId: payload.transactionId ?? '',
    redirectUrl: payload.redirectUrl ?? null,
    bookingId: payload.bookingId ?? null,
    mock: payload.mock,
  };
}

async function postManageBookingMutation(params: {
  readonly apiBaseUrl: string;
  readonly path: string;
  readonly body: Record<string, string>;
  readonly signal?: AbortSignal;
  readonly fallbackError: string;
}): Promise<GuestBookingManageView> {
  const url = buildApiUrl(params.apiBaseUrl, params.path);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.body),
    signal: params.signal,
  });
  const payload = (await response.json()) as { ok?: boolean; booking?: GuestBookingManageView; error?: string };
  if (!response.ok || payload.ok !== true || payload.booking === undefined) {
    throw new Error(typeof payload.error === 'string' ? payload.error : params.fallbackError);
  }
  return payload.booking;
}

export async function rescheduleGuestManagedBooking(params: {
  readonly apiBaseUrl: string;
  readonly credentials: GuestBookingManageCredentials;
  readonly dateYmd: string;
  readonly timeLabel: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  return postManageBookingMutation({
    apiBaseUrl: params.apiBaseUrl,
    path: '/api/bookings/manage/reschedule',
    body: {
      bookingReference: params.credentials.bookingReference,
      email: params.credentials.email,
      phoneLastFour: params.credentials.phoneLastFour,
      date: params.dateYmd,
      time: params.timeLabel,
    },
    signal: params.signal,
    fallbackError: 'Could not reschedule this booking.',
  });
}

export async function rescheduleAccountManagedBooking(params: {
  readonly apiBaseUrl: string;
  readonly bookingId: string;
  readonly dateYmd: string;
  readonly timeLabel: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  return postManageBookingMutation({
    apiBaseUrl: params.apiBaseUrl,
    path: '/api/bookings/manage/reschedule-account',
    body: { bookingId: params.bookingId, date: params.dateYmd, time: params.timeLabel },
    signal: params.signal,
    fallbackError: 'Could not reschedule this booking.',
  });
}

export async function abandonGuestManagedBooking(params: {
  readonly apiBaseUrl: string;
  readonly credentials: GuestBookingManageCredentials;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  return postManageBookingMutation({
    apiBaseUrl: params.apiBaseUrl,
    path: '/api/bookings/manage/abandon',
    body: {
      bookingReference: params.credentials.bookingReference,
      email: params.credentials.email,
      phoneLastFour: params.credentials.phoneLastFour,
    },
    signal: params.signal,
    fallbackError: 'Could not cancel this booking.',
  });
}

export async function abandonAccountManagedBooking(params: {
  readonly apiBaseUrl: string;
  readonly bookingId: string;
  readonly signal?: AbortSignal;
}): Promise<GuestBookingManageView> {
  return postManageBookingMutation({
    apiBaseUrl: params.apiBaseUrl,
    path: '/api/bookings/manage/abandon-account',
    body: { bookingId: params.bookingId },
    signal: params.signal,
    fallbackError: 'Could not cancel this booking.',
  });
}

export async function createAccountBookingManageCheckout(params: {
  readonly apiBaseUrl: string;
  readonly bookingId: string;
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
  const url = buildApiUrl(params.apiBaseUrl, '/api/bookings/manage/checkout-account');
  const body: Record<string, string | boolean> = {
    bookingId: params.bookingId,
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
    payabilityCode?: string;
    debug?: Record<string, unknown>;
  };
  if (!response.ok || payload.ok !== true) {
    const error = new Error(typeof payload.error === 'string' ? payload.error : 'Checkout failed.');
    if (typeof payload.payabilityCode === 'string') {
      (error as Error & { payabilityCode: string }).payabilityCode = payload.payabilityCode;
    }
    if (payload.debug !== undefined) {
      (error as Error & { payabilityDebug: Record<string, unknown> }).payabilityDebug = payload.debug;
    }
    throw error;
  }
  return {
    transactionId: payload.transactionId ?? '',
    redirectUrl: payload.redirectUrl ?? null,
    bookingId: payload.bookingId ?? null,
    mock: payload.mock,
  };
}
