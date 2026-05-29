import { formatInTimeZone } from 'date-fns-tz';
import type { PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type PaymentHoldExpiryLabels = {
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly timezoneLabel: string;
};

export type ReservedBookingSlotLabels = {
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly timezoneLabel: string;
};

/** Prefer `resolveServerSyncedNowMsFromAnchor` for live countdowns — this uses wall-clock time. */
export function resolveServerSyncedNowMs(serverClockOffsetMs: number | null): number | null {
  if (serverClockOffsetMs === null) {
    return null;
  }
  return Date.now() + serverClockOffsetMs;
}

export function parsePaymentHoldExpiresAtMs(expiresAtIso: string | null | undefined): number | null {
  const normalized = expiresAtIso?.trim() ?? '';
  if (normalized.length === 0) {
    return null;
  }
  const expiresAtMs = Date.parse(normalized);
  if (!Number.isFinite(expiresAtMs)) {
    return null;
  }
  return expiresAtMs;
}

export function isPaymentHoldExpiredByServerClock(input: {
  readonly serverNowMs: number | null;
  readonly expiresAtIso: string | null | undefined;
}): boolean {
  const expiresAtMs = parsePaymentHoldExpiresAtMs(input.expiresAtIso);
  if (expiresAtMs === null || input.serverNowMs === null) {
    return false;
  }
  return input.serverNowMs >= expiresAtMs;
}

export function buildReservedBookingSlotLabels(
  startsAtIso: string,
  timezone: string = PRIMARY_TIMEZONE,
): ReservedBookingSlotLabels | null {
  const normalized = startsAtIso.trim();
  if (normalized.length === 0) {
    return null;
  }
  const startsAt = new Date(normalized);
  if (!Number.isFinite(startsAt.getTime())) {
    return null;
  }
  const resolvedTimezone = timezone.trim().length > 0 ? timezone.trim() : PRIMARY_TIMEZONE;
  return {
    dateLabel: formatInTimeZone(startsAt, resolvedTimezone, 'EEEE, MMMM d, yyyy'),
    timeLabel: formatInTimeZone(startsAt, resolvedTimezone, 'h:mm a'),
    timezoneLabel: resolvedTimezone,
  };
}

export function buildPaymentHoldExpiryLabels(
  expiresAtIso: string,
  timezone: string = PRIMARY_TIMEZONE,
): PaymentHoldExpiryLabels {
  const resolvedTimezone = timezone.trim().length > 0 ? timezone.trim() : PRIMARY_TIMEZONE;
  const expiresAt = new Date(expiresAtIso);
  return {
    dateLabel: formatInTimeZone(expiresAt, resolvedTimezone, 'EEEE, MMMM d, yyyy'),
    timeLabel: formatInTimeZone(expiresAt, resolvedTimezone, 'h:mm:ss a'),
    timezoneLabel: resolvedTimezone,
  };
}

export function formatServerSyncedTimeLabel(serverNowMs: number, timezone: string = PRIMARY_TIMEZONE): string {
  const resolvedTimezone = timezone.trim().length > 0 ? timezone.trim() : PRIMARY_TIMEZONE;
  return formatInTimeZone(new Date(serverNowMs), resolvedTimezone, 'h:mm:ss a');
}

/** Resolves the payment hold deadline from booking, transaction, or hold window settings. */
export function resolvePaymentHoldExpiresAtIso(input: {
  readonly bookingPaymentExpiresAtIso: string | null | undefined;
  readonly transactionExpiresAtIso: string | null | undefined;
  readonly transactionCreatedAtIso: string | null | undefined;
  readonly holdExpiresMinutes: number;
}): string | null {
  const fromBooking = input.bookingPaymentExpiresAtIso?.trim() ?? '';
  if (fromBooking.length > 0) {
    return fromBooking;
  }
  const fromTransaction = input.transactionExpiresAtIso?.trim() ?? '';
  if (fromTransaction.length > 0) {
    return fromTransaction;
  }
  const createdAtIso = input.transactionCreatedAtIso?.trim() ?? '';
  if (createdAtIso.length > 0 && input.holdExpiresMinutes > 0) {
    const createdAtMs = Date.parse(createdAtIso);
    if (Number.isFinite(createdAtMs)) {
      return new Date(createdAtMs + input.holdExpiresMinutes * 60_000).toISOString();
    }
  }
  return null;
}

export function isOpenPaymentTransactionHoldActive(
  transaction: PaymentTransactionRow,
  nowMs: number = Date.now(),
): boolean {
  if (transaction.status !== 'pending' && transaction.status !== 'processing') {
    return false;
  }
  const expiresAtMs = parsePaymentHoldExpiresAtMs(transaction.expiresAtIso);
  if (expiresAtMs === null) {
    return true;
  }
  return expiresAtMs > nowMs;
}
