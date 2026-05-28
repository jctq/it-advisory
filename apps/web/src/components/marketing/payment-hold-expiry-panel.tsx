'use client';

import type { ReactElement } from 'react';
import {
  buildPaymentHoldExpiryLabels,
  buildReservedBookingSlotLabels,
  formatServerSyncedTimeLabel,
  isPaymentHoldExpiredByServerClock,
} from '@/lib/marketing/payment-hold-expiry';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type PaymentHoldExpiryPanelProps = {
  readonly expiresAtIso: string;
  readonly timezone?: string;
  readonly serverNowMs: number | null;
  readonly variant?: 'dialog' | 'inline';
};

export type PaymentHoldReservedSlotPanelProps = {
  readonly startsAtIso: string;
  readonly timezone?: string;
  readonly variant?: 'dialog' | 'inline';
};

export function PaymentHoldReservedSlotPanel(props: PaymentHoldReservedSlotPanelProps): ReactElement | null {
  const timezone = props.timezone?.trim().length ? props.timezone!.trim() : PRIMARY_TIMEZONE;
  const labels = buildReservedBookingSlotLabels(props.startsAtIso, timezone);
  if (labels === null) {
    return null;
  }
  const highlightClassName =
    props.variant === 'dialog'
      ? 'rounded-xl border border-border bg-muted/50 px-4 py-4'
      : 'rounded-xl border border-border/80 bg-muted/30 px-4 py-3';
  return (
    <div className={highlightClassName}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reserved slot</p>
      <p className="mt-1 text-base font-semibold leading-snug text-foreground">{labels.dateLabel}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{labels.timeLabel}</p>
      <p className="mt-2 text-xs text-muted-foreground">{labels.timezoneLabel}</p>
    </div>
  );
}

export function PaymentHoldExpiryPanel(props: PaymentHoldExpiryPanelProps): ReactElement {
  const timezone = props.timezone?.trim().length ? props.timezone!.trim() : PRIMARY_TIMEZONE;
  const labels = buildPaymentHoldExpiryLabels(props.expiresAtIso, timezone);
  const isExpired = isPaymentHoldExpiredByServerClock({
    serverNowMs: props.serverNowMs,
    expiresAtIso: props.expiresAtIso,
  });
  const serverTimeLabel =
    props.serverNowMs !== null ? formatServerSyncedTimeLabel(props.serverNowMs, timezone) : null;
  const highlightClassName =
    props.variant === 'dialog'
      ? 'rounded-xl border-2 border-amber-500 bg-amber-500/15 px-4 py-4'
      : 'rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-3';
  return (
    <div className="space-y-3">
      <div className={highlightClassName}>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
          Pay on or before
        </p>
        <p className="mt-1 text-base font-semibold leading-snug text-amber-950 dark:text-amber-50">{labels.dateLabel}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{labels.timeLabel}</p>
        <p className="mt-2 text-xs text-muted-foreground">{labels.timezoneLabel}</p>
      </div>
      {serverTimeLabel !== null ? (
        <p className="text-sm text-muted-foreground">
          Server time now:{' '}
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">{serverTimeLabel}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Syncing server time…</p>
      )}
      {isExpired ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
          The payment window has ended. This booking is being cancelled — payment is no longer available.
        </p>
      ) : null}
    </div>
  );
}
