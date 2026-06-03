export const PAYMENT_CHECKOUT_PREP_TTL_MS = 8 * 60 * 1000;
export const PAYMENT_CHECKOUT_PREP_DEBOUNCE_MS = 400;

export type PaymentCheckoutPrepCacheEntry = {
  readonly prepKey: string;
  readonly transactionId: string;
  readonly redirectUrl: string;
  readonly preparedAt: number;
};

function buildStorageKey(scope: string): string {
  return `teqmd:checkout-prep:${scope}`;
}

export function readPaymentCheckoutPrep(scope: string): PaymentCheckoutPrepCacheEntry | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(buildStorageKey(scope));
    if (raw === null || raw.length === 0) {
      return null;
    }
    const parsed = JSON.parse(raw) as PaymentCheckoutPrepCacheEntry;
    if (
      typeof parsed.prepKey !== 'string' ||
      typeof parsed.transactionId !== 'string' ||
      typeof parsed.redirectUrl !== 'string' ||
      typeof parsed.preparedAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.preparedAt > PAYMENT_CHECKOUT_PREP_TTL_MS) {
      window.sessionStorage.removeItem(buildStorageKey(scope));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePaymentCheckoutPrep(scope: string, entry: PaymentCheckoutPrepCacheEntry): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(buildStorageKey(scope), JSON.stringify(entry));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function clearPaymentCheckoutPrep(scope: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(buildStorageKey(scope));
  } catch {
    // ignore
  }
}

export function buildMarketingCheckoutPrepKey(input: {
  readonly diagnosticSessionId: string;
  readonly gatewayId: string;
  readonly paymentMethodId: string;
  readonly date: string;
  readonly time: string;
  readonly serviceKey: string;
  readonly amountCentavos: number;
  readonly promoCode: string;
  readonly recordingOptIn: boolean;
}): string {
  return [
    input.diagnosticSessionId,
    input.gatewayId,
    input.paymentMethodId,
    input.date,
    input.time,
    input.serviceKey,
    String(input.amountCentavos),
    input.promoCode,
    input.recordingOptIn ? '1' : '0',
  ].join('|');
}

export function buildManageCheckoutPrepKey(input: {
  readonly bookingReference: string;
  readonly gatewayId: string;
  readonly paymentMethodId: string;
  readonly amountCentavos: number;
}): string {
  return [input.bookingReference, input.gatewayId, input.paymentMethodId, String(input.amountCentavos)].join('|');
}

export function buildAccountManageCheckoutPrepKey(input: {
  readonly bookingId: string;
  readonly gatewayId: string;
  readonly paymentMethodId: string;
  readonly amountCentavos: number;
}): string {
  return [input.bookingId, input.gatewayId, input.paymentMethodId, String(input.amountCentavos)].join('|');
}
