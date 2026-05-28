import { formatInTimeZone } from 'date-fns-tz';
import type { PaymentStatus } from '@/domain/payment-types';
import { DEFAULT_BOOKING_SERVICE_KEY } from '@/store/marketing';
import { hasCheckoutManageContact } from '@/lib/marketing/checkout-contact';
import { formatBookingSlotPartsFromStartsAt } from '@/lib/marketing/booking-slot-from-starts-at';
import { isPaymentHoldExpiredByServerClock } from '@/lib/marketing/payment-hold-expiry';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

const DEFAULT_SERVICE_KEY = DEFAULT_BOOKING_SERVICE_KEY;

export type LinkedBookingSlotSnapshot = {
  readonly bookingId: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly paymentTransactionId: string | null;
  readonly paymentMethodLabel: string | null;
  readonly paymentStatus: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerCompany: string | null;
  readonly customerPhone: string | null;
  readonly paymentExpiresAtIso: string | null;
};

export function formatPaymentExpiresAtLabel(
  expiresAtIso: string | null | undefined,
  timezone: string = PRIMARY_TIMEZONE,
): string | null {
  const normalized = expiresAtIso?.trim() ?? '';
  if (normalized.length === 0) {
    return null;
  }
  const expiresAt = new Date(normalized);
  if (!Number.isFinite(expiresAt.getTime())) {
    return null;
  }
  const resolvedTimezone = timezone.trim().length > 0 ? timezone.trim() : PRIMARY_TIMEZONE;
  return formatInTimeZone(expiresAt, resolvedTimezone, 'EEEE, MMMM d, yyyy · h:mm a');
}

export function formatLinkedBookingPaymentDeadlineLabel(
  linked: Pick<LinkedBookingSlotSnapshot, 'paymentExpiresAtIso' | 'timezone'>,
): string | null {
  return formatPaymentExpiresAtLabel(linked.paymentExpiresAtIso, linked.timezone);
}

export type PendingCheckoutSnapshot = {
  readonly transactionId: string;
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerCompany: string | null;
  readonly customerPhone: string | null;
  readonly expiresAtIso: string | null;
  readonly bookingId: string | null;
};

export function parsePendingCheckoutSnapshot(value: unknown): PendingCheckoutSnapshot | null {
  if (value === null || value === undefined || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const transactionId = typeof row.transactionId === 'string' ? row.transactionId.trim() : '';
  const startsAtIso = typeof row.startsAtIso === 'string' ? row.startsAtIso.trim() : '';
  if (transactionId.length === 0 || startsAtIso.length === 0) {
    return null;
  }
  const timezone =
    typeof row.timezone === 'string' && row.timezone.trim().length > 0 ? row.timezone.trim() : PRIMARY_TIMEZONE;
  const serviceKey =
    typeof row.serviceKey === 'string' && row.serviceKey.trim().length > 0
      ? row.serviceKey.trim()
      : DEFAULT_SERVICE_KEY;
  const customerNameRaw = typeof row.customerName === 'string' ? row.customerName.trim() : '';
  const customerEmailRaw = typeof row.customerEmail === 'string' ? row.customerEmail.trim() : '';
  const customerCompanyRaw = typeof row.customerCompany === 'string' ? row.customerCompany.trim() : '';
  const customerPhoneRaw = typeof row.customerPhone === 'string' ? row.customerPhone.trim() : '';
  const bookingIdRaw = typeof row.bookingId === 'string' ? row.bookingId.trim() : '';
  return {
    transactionId,
    startsAtIso,
    timezone,
    serviceKey,
    customerName: customerNameRaw.length > 0 ? customerNameRaw : null,
    customerEmail: customerEmailRaw.length > 0 ? customerEmailRaw : null,
    customerCompany: customerCompanyRaw.length > 0 ? customerCompanyRaw : null,
    customerPhone: customerPhoneRaw.length > 0 ? customerPhoneRaw : null,
    expiresAtIso:
      typeof row.expiresAtIso === 'string' && row.expiresAtIso.trim().length > 0 ? row.expiresAtIso.trim() : null,
    bookingId: bookingIdRaw.length > 0 ? bookingIdRaw : null,
  };
}

export function pendingCheckoutToCheckoutDraft(pending: PendingCheckoutSnapshot): {
  readonly date: string;
  readonly time: string;
  readonly fullName: string;
  readonly email: string;
  readonly company: string;
  readonly phone: string;
  readonly serviceKey: string;
} {
  const parts = formatBookingSlotPartsFromStartsAt(new Date(pending.startsAtIso), pending.timezone);
  return {
    date: parts.date,
    time: parts.time,
    fullName: pending.customerName ?? '',
    email: pending.customerEmail ?? '',
    company: pending.customerCompany ?? '',
    phone: pending.customerPhone ?? '',
    serviceKey: pending.serviceKey,
  };
}

export function pendingCheckoutHasManageContact(pending: PendingCheckoutSnapshot): boolean {
  return hasCheckoutManageContact({
    fullName: pending.customerName ?? '',
    email: pending.customerEmail ?? '',
    phone: pending.customerPhone ?? '',
  });
}

export function isLinkedBookingPendingPayment(linked: LinkedBookingSlotSnapshot): boolean {
  return linked.status === 'pending' && linked.paymentStatus !== 'paid';
}

export function linkedBookingHasManageContact(linked: LinkedBookingSlotSnapshot): boolean {
  return hasCheckoutManageContact({
    fullName: linked.customerName ?? '',
    email: linked.customerEmail ?? '',
    phone: linked.customerPhone ?? '',
  });
}

export function linkedBookingToCheckoutDraft(linked: LinkedBookingSlotSnapshot): {
  readonly date: string;
  readonly time: string;
  readonly fullName: string;
  readonly email: string;
  readonly company: string;
  readonly phone: string;
  readonly serviceKey: string;
} {
  const parts = formatBookingSlotPartsFromStartsAt(new Date(linked.startsAtIso), linked.timezone);
  return {
    date: parts.date,
    time: parts.time,
    fullName: linked.customerName ?? '',
    email: linked.customerEmail ?? '',
    company: linked.customerCompany ?? '',
    phone: linked.customerPhone ?? '',
    serviceKey: linked.serviceKey,
  };
}

export function isLinkedBookingCancelled(linked: LinkedBookingSlotSnapshot): boolean {
  return linked.status === 'cancelled';
}

function isTerminalPaymentStatus(status: PaymentStatus | null | undefined): boolean {
  return status === 'expired' || status === 'failed' || status === 'paid';
}

export function isPaymentHoldWindowClosed(input: {
  readonly paymentExpiresAtIso: string | null | undefined;
  readonly serverNowMs: number;
}): boolean {
  return isPaymentHoldExpiredByServerClock({
    serverNowMs: input.serverNowMs,
    expiresAtIso: input.paymentExpiresAtIso,
  });
}

/** True when checkout can resume for a linked pending booking (hold open, payment not terminal). */
export function isLinkedBookingCheckoutResumable(
  linked: LinkedBookingSlotSnapshot,
  input: {
    readonly latestPaymentStatus: PaymentStatus | null;
    readonly serverNowMs: number;
  },
): boolean {
  if (isLinkedBookingCancelled(linked)) {
    return false;
  }
  if (!isLinkedBookingPendingPayment(linked)) {
    return false;
  }
  if (isTerminalPaymentStatus(input.latestPaymentStatus)) {
    return false;
  }
  if (isTerminalPaymentStatus(linked.paymentStatus as PaymentStatus | null)) {
    return false;
  }
  if (isPaymentHoldWindowClosed({ paymentExpiresAtIso: linked.paymentExpiresAtIso, serverNowMs: input.serverNowMs })) {
    return false;
  }
  return true;
}

/** True when a pay-before-booking checkout row can still be resumed. */
export function isPendingCheckoutResumable(
  pending: PendingCheckoutSnapshot,
  input: {
    readonly latestPaymentStatus: PaymentStatus | null;
    readonly paymentHoldExpiresAtIso: string | null | undefined;
    readonly serverNowMs: number;
  },
): boolean {
  if (isTerminalPaymentStatus(input.latestPaymentStatus)) {
    return false;
  }
  const expiresAtIso = pending.expiresAtIso ?? input.paymentHoldExpiresAtIso;
  if (isPaymentHoldWindowClosed({ paymentExpiresAtIso: expiresAtIso, serverNowMs: input.serverNowMs })) {
    return false;
  }
  return true;
}

export function parseLinkedBookingSlotSnapshot(value: unknown): LinkedBookingSlotSnapshot | null {
  if (value === null || value === undefined || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const bookingId = typeof row.bookingId === 'string' ? row.bookingId.trim() : '';
  const startsAtIso = typeof row.startsAtIso === 'string' ? row.startsAtIso.trim() : '';
  if (bookingId.length === 0 || startsAtIso.length === 0) {
    return null;
  }
  const statusRaw = row.status;
  const status =
    statusRaw === 'pending' || statusRaw === 'confirmed' || statusRaw === 'cancelled' ? statusRaw : 'confirmed';
  const timezone =
    typeof row.timezone === 'string' && row.timezone.trim().length > 0 ? row.timezone.trim() : PRIMARY_TIMEZONE;
  const serviceKey =
    typeof row.serviceKey === 'string' && row.serviceKey.trim().length > 0
      ? row.serviceKey.trim()
      : DEFAULT_SERVICE_KEY;
  const meetingRaw = typeof row.meetingUrl === 'string' ? row.meetingUrl.trim() : '';
  const paymentTransactionId =
    typeof row.paymentTransactionId === 'string' && row.paymentTransactionId.trim().length > 0
      ? row.paymentTransactionId.trim()
      : null;
  const paymentMethodRaw = typeof row.paymentMethodLabel === 'string' ? row.paymentMethodLabel.trim() : '';
  const customerNameRaw = typeof row.customerName === 'string' ? row.customerName.trim() : '';
  const customerEmailRaw = typeof row.customerEmail === 'string' ? row.customerEmail.trim() : '';
  const customerCompanyRaw = typeof row.customerCompany === 'string' ? row.customerCompany.trim() : '';
  const customerPhoneRaw = typeof row.customerPhone === 'string' ? row.customerPhone.trim() : '';
  return {
    bookingId,
    status,
    startsAtIso,
    timezone,
    serviceKey,
    meetingUrl: meetingRaw.length > 0 ? meetingRaw : null,
    paymentTransactionId,
    paymentMethodLabel: paymentMethodRaw.length > 0 ? paymentMethodRaw : null,
    paymentStatus: typeof row.paymentStatus === 'string' ? row.paymentStatus : null,
    customerName: customerNameRaw.length > 0 ? customerNameRaw : null,
    customerEmail: customerEmailRaw.length > 0 ? customerEmailRaw : null,
    customerCompany: customerCompanyRaw.length > 0 ? customerCompanyRaw : null,
    customerPhone: customerPhoneRaw.length > 0 ? customerPhoneRaw : null,
    paymentExpiresAtIso:
      typeof row.paymentExpiresAtIso === 'string' && row.paymentExpiresAtIso.trim().length > 0
        ? row.paymentExpiresAtIso.trim()
        : null,
  };
}

export function resolveDiagnosticShowBookingActions(params: {
  readonly sessionReadOnly: boolean;
  readonly linkedBookingSlot: LinkedBookingSlotSnapshot | null;
}): boolean {
  if (!params.sessionReadOnly) {
    return true;
  }
  if (params.linkedBookingSlot === null) {
    return false;
  }
  if (isLinkedBookingCancelled(params.linkedBookingSlot)) {
    return false;
  }
  return isLinkedBookingCheckoutResumable(params.linkedBookingSlot, {
    latestPaymentStatus: null,
    serverNowMs: Date.now(),
  });
}
