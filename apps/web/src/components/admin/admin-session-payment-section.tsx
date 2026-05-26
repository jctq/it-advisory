'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import type { PaymentGatewayId, PaymentStatus } from '@/domain/payment-types';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { formatPaymentAmountLabel } from '@/lib/data/payment-settings';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminSessionPaymentSectionProps = {
  readonly sessionId: string;
  readonly transactionId: string;
  readonly status: PaymentStatus;
  readonly gatewayId: PaymentGatewayId;
  readonly amountCentavos: number;
  readonly bookingId: string | null;
  readonly customerEmail: string | null;
};

const GATEWAY_LABELS: Record<PaymentGatewayId, string> = {
  paymongo: 'PayMongo',
  xendit: 'Xendit',
  hitpay: 'HitPay',
  paypal: 'PayPal',
};

export function AdminSessionPaymentSection(props: AdminSessionPaymentSectionProps): ReactElement {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const executeSyncPayment = (): void => {
    setIsSyncing(true);
    void fetch(buildApiUrl(`/api/admin/quiz-sessions/${props.sessionId}/sync-payment`), { method: 'POST' })
      .then(async (response) => {
        const data = (await response.json()) as { error?: string; status?: PaymentStatus; bookingId?: string | null };
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
          <h2 className="text-lg font-semibold text-foreground">Checkout payment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest payment attempt for this diagnostic. Sync if the customer paid but no booking appears.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={isSyncing} onClick={executeSyncPayment}>
          <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden />
          {isSyncing ? 'Syncing…' : 'Sync from provider'}
        </Button>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{props.status}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gateway</dt>
          <dd className="mt-1 text-sm text-foreground">{GATEWAY_LABELS[props.gatewayId]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</dt>
          <dd className="mt-1 text-sm text-foreground">{formatPaymentAmountLabel(props.amountCentavos)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer email</dt>
          <dd className="mt-1 text-sm text-foreground">{props.customerEmail ?? '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction id</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">{props.transactionId}</dd>
        </div>
        {props.bookingId !== null ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked booking</dt>
            <dd className="mt-1 text-sm">
              <Link href={`/admin/bookings/${props.bookingId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {formatBookingReferenceId(props.bookingId)} — open booking
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
