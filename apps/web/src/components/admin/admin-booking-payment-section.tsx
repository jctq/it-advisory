'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import type { PaymentGatewayId, PaymentStatus } from '@/domain/payment-types';
import { Button } from '@/components/ui/button';
import { CopyToClipboardButton } from '@/components/ui/copy-to-clipboard-button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { formatPaymentAmountLabel } from '@/lib/payments/format-payment-amount-label';
import type { BookingPaymentBreakdown } from '@/lib/payments/booking-payment-breakdown-types';
import { cn } from '@/lib/utils';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminBookingPaymentSectionProps = {
  readonly bookingId: string;
  readonly paymentTransactionId: string | null;
  readonly paymentStatus: PaymentStatus | null;
  readonly paymentGatewayId: PaymentGatewayId | null;
  readonly paymentMethodLabel: string | null;
  readonly paymentProviderRef: string | null;
  readonly amountCentavos: number | null;
  readonly paymentBreakdown: BookingPaymentBreakdown | null;
};

function PaymentBreakdownLineItem(props: {
  readonly label: string;
  readonly value: string;
  readonly valueClassName?: string;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="min-w-0 text-muted-foreground">{props.label}</span>
      <span className={cn('shrink-0 tabular-nums font-medium text-foreground', props.valueClassName)}>
        {props.value}
      </span>
    </div>
  );
}

function AdminBookingPaymentBreakdown(props: {
  readonly breakdown: BookingPaymentBreakdown;
  readonly isPaid: boolean;
}): ReactElement {
  const { breakdown, isPaid } = props;
  const hasDiscount = breakdown.discountCentavos > 0 && breakdown.discountLabel !== null;
  const hasRecording = breakdown.recordingSurchargeLabel !== null;
  const sectionTitle = isPaid ? 'Paid services' : 'Services & pricing';
  const totalLabel = isPaid ? 'Total charged' : 'Total';
  return (
    <section
      className="mt-6 rounded-xl border border-border/80 bg-muted/15 px-4 py-4"
      aria-labelledby="booking-payment-breakdown-heading"
    >
      <h3 id="booking-payment-breakdown-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {sectionTitle}
      </h3>
      <div className="mt-3 space-y-2.5">
        <PaymentBreakdownLineItem label={breakdown.serviceTitle} value={breakdown.subtotalAmountLabel} />
        {hasDiscount ? (
          <PaymentBreakdownLineItem
            label={
              breakdown.appliedPromoCode !== null
                ? `Discount (${breakdown.appliedPromoCode})`
                : 'Discount'
            }
            value={`−${breakdown.discountLabel}`}
            valueClassName="font-semibold text-emerald-600 dark:text-emerald-400"
          />
        ) : null}
        {hasRecording ? (
          <PaymentBreakdownLineItem label="AI meeting notes & recording" value={`+${breakdown.recordingSurchargeLabel}`} />
        ) : null}
        <div className="flex items-center justify-between gap-4 border-t border-border/80 pt-3">
          <span className="text-sm font-semibold text-foreground">{totalLabel}</span>
          <span className="text-sm font-bold tabular-nums text-foreground">{breakdown.totalLabel}</span>
        </div>
      </div>
    </section>
  );
}

const GATEWAY_LABELS: Record<PaymentGatewayId, string> = {
  paymongo: 'PayMongo',
  xendit: 'Xendit',
  hitpay: 'HitPay',
  paypal: 'PayPal',
};

function formatPaymentStatusLabel(status: PaymentStatus | null): string {
  if (status === null) {
    return 'Not recorded';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AdminBookingPaymentSection(props: AdminBookingPaymentSectionProps): ReactElement {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const canSync = props.paymentTransactionId !== null;
  const executeSyncPayment = (): void => {
    if (!canSync) {
      return;
    }
    setIsSyncing(true);
    void fetch(buildApiUrl(`/api/admin/bookings/${props.bookingId}/sync-payment`), { method: 'POST' })
      .then(async (response) => {
        const data = (await response.json()) as { error?: string; status?: PaymentStatus };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Could not sync payment.');
        }
        notifySuccess(`Payment synced (${data.status ?? 'updated'}).`);
        router.refresh();
      })
      .catch((error: unknown) => {
        notifyError(error instanceof Error ? error.message : 'Could not sync payment.');
      })
      .finally(() => {
        setIsSyncing(false);
      });
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Payment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Online checkout status from the linked transaction. Sync pulls the latest state from the payment provider.
          </p>
        </div>
        {canSync ? (
          <Button type="button" variant="outline" size="sm" className="gap-2" disabled={isSyncing} onClick={executeSyncPayment}>
            <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden />
            {isSyncing ? 'Syncing…' : 'Sync from provider'}
          </Button>
        ) : null}
      </div>
      {props.paymentBreakdown !== null ? (
        <AdminBookingPaymentBreakdown breakdown={props.paymentBreakdown} isPaid={props.paymentStatus === 'paid'} />
      ) : null}
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment status</dt>
          <dd className="mt-1 text-sm text-foreground">{formatPaymentStatusLabel(props.paymentStatus)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gateway</dt>
          <dd className="mt-1 text-sm text-foreground">
            {props.paymentGatewayId !== null ? GATEWAY_LABELS[props.paymentGatewayId] : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Method</dt>
          <dd className="mt-1 text-sm text-foreground">{props.paymentMethodLabel ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</dt>
          <dd className="mt-1 text-sm text-foreground">
            {props.amountCentavos !== null ? formatPaymentAmountLabel(props.amountCentavos) : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provider reference</dt>
          <dd className="mt-1 text-sm text-foreground">
            {props.paymentProviderRef !== null ? (
              <div className="flex items-center gap-1">
                <span className="min-w-0 break-all font-mono">{props.paymentProviderRef}</span>
                <CopyToClipboardButton value={props.paymentProviderRef} ariaLabel="Copy provider reference" />
              </div>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {props.paymentTransactionId !== null ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction id</dt>
            <dd className="mt-1 text-sm text-foreground">
              <div className="flex items-center gap-1">
                <span className="min-w-0 break-all font-mono text-xs">{props.paymentTransactionId}</span>
                <CopyToClipboardButton value={props.paymentTransactionId} ariaLabel="Copy transaction id" />
              </div>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
