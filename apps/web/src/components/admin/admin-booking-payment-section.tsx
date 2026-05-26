'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import type { PaymentGatewayId, PaymentStatus } from '@/domain/payment-types';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { formatPaymentAmountLabel } from '@/lib/data/payment-settings';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminBookingPaymentSectionProps = {
  readonly bookingId: string;
  readonly paymentTransactionId: string | null;
  readonly paymentStatus: PaymentStatus | null;
  readonly paymentGatewayId: PaymentGatewayId | null;
  readonly paymentMethodLabel: string | null;
  readonly paymentProviderRef: string | null;
  readonly amountCentavos: number | null;
};

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
          <dd className="mt-1 font-mono text-sm text-foreground">{props.paymentProviderRef ?? '—'}</dd>
        </div>
        {props.paymentTransactionId !== null ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction id</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{props.paymentTransactionId}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
