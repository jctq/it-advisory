'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PaymentLogAdminRow } from '@/lib/data/payment-logs';
import type { PaymentLogOutcome } from '@/domain/payment-log-types';

type AdminPaymentLogsTableProps = {
  readonly initialData: readonly PaymentLogAdminRow[];
};

const columnHelper = createColumnHelper<PaymentLogAdminRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function resolveOutcomeBadgeVariant(
  outcome: PaymentLogOutcome,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (outcome === 'updated') {
    return 'default';
  }
  if (outcome === 'noop') {
    return 'secondary';
  }
  if (
    outcome === 'credentials_missing' ||
    outcome === 'parse_failed' ||
    outcome === 'transaction_not_found' ||
    outcome === 'processing_failed' ||
    outcome === 'unexpected_error'
  ) {
    return 'destructive';
  }
  return 'outline';
}

function formatOutcomeLabel(outcome: PaymentLogOutcome): string {
  return outcome.replaceAll('_', ' ');
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return '—';
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatAmount(amountCentavos: number | null): string {
  if (amountCentavos === null) {
    return '—';
  }
  return `₱${(amountCentavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatStatusTransition(row: PaymentLogAdminRow): string {
  if (row.transactionStatusBefore === null && row.transactionStatusAfter === null) {
    return row.reportedStatus ?? '—';
  }
  if (row.transactionStatusAfter === null) {
    return row.transactionStatusBefore ?? '—';
  }
  if (row.transactionStatusBefore === null) {
    return row.transactionStatusAfter;
  }
  if (row.transactionStatusBefore === row.transactionStatusAfter) {
    return row.transactionStatusAfter;
  }
  return `${row.transactionStatusBefore} → ${row.transactionStatusAfter}`;
}

function formatCustomer(row: PaymentLogAdminRow): string {
  if (row.customerName !== null && row.customerEmail !== null) {
    return `${row.customerName} · ${row.customerEmail}`;
  }
  if (row.customerEmail !== null) {
    return row.customerEmail;
  }
  if (row.customerName !== null) {
    return row.customerName;
  }
  return '—';
}

function formatDetailSummary(row: PaymentLogAdminRow): string {
  const parts: string[] = [];
  if (row.errorMessage !== null && row.errorMessage.length > 0) {
    parts.push(row.errorMessage);
  }
  if (row.providerSessionId !== null) {
    parts.push(`session: ${row.providerSessionId}`);
  }
  if (row.transactionId !== null) {
    parts.push(`txn: ${row.transactionId}`);
  }
  if (row.processingKind !== null) {
    parts.push(`kind: ${row.processingKind}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function renderDetailField(label: string, value: string | null): ReactElement | null {
  if (value === null || value.length === 0) {
    return null;
  }
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-foreground">{value}</dd>
    </div>
  );
}

function PaymentLogDetailDialog(props: {
  readonly row: PaymentLogAdminRow | null;
  readonly onClose: () => void;
}): ReactElement {
  const row = props.row;
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {row !== null ? (
          <>
            <DialogHeader>
              <DialogTitle>Payment log</DialogTitle>
              <DialogDescription>
                {row.gatewayLabel} · {DATE_TIME_FORMATTER.format(new Date(row.receivedAtIso))} · HTTP {row.httpStatus}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome</dt>
                <dd className="mt-1">
                  <Badge variant={resolveOutcomeBadgeVariant(row.outcome)} className="capitalize">
                    {formatOutcomeLabel(row.outcome)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration</dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">{formatDuration(row.durationMs)}</dd>
              </div>
              {renderDetailField('Reported status', row.reportedStatus)}
              {renderDetailField('Status transition', formatStatusTransition(row))}
              {renderDetailField('Amount', formatAmount(row.amountCentavos))}
              {renderDetailField('Customer', formatCustomer(row))}
              {renderDetailField('Visitor id', row.visitorId)}
              {renderDetailField('Service', row.serviceKey)}
              {renderDetailField('Payment method', row.paymentMethodLabel)}
              {renderDetailField('Hold expires', row.expiresAtIso)}
              {renderDetailField('Provider session id', row.providerSessionId)}
              {renderDetailField('Provider ref', row.providerRef)}
              {renderDetailField('Transaction id', row.transactionId)}
              {renderDetailField('Processing kind', row.processingKind)}
              {row.bookingId !== null ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking</dt>
                  <dd className="mt-1">
                    <Link href={`/admin/bookings/${row.bookingId}`} className="font-mono text-xs text-primary hover:underline">
                      {row.bookingId}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {row.errorMessage !== null && row.errorMessage.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</dt>
                  <dd className="mt-1 text-sm text-foreground">{row.errorMessage}</dd>
                </div>
              ) : null}
              {row.requestHeadersSummary !== null ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request headers</dt>
                  <dd className="mt-1 space-y-1 font-mono text-xs text-foreground">
                    {Object.entries(row.requestHeadersSummary).map(([key, value]) => (
                      <div key={key}>
                        {key}: {value}
                      </div>
                    ))}
                  </dd>
                </div>
              ) : null}
              {row.rawPayloadSnippet !== null && row.rawPayloadSnippet.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw payload snippet</dt>
                  <dd className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap text-foreground">
                    {row.rawPayloadSnippet}
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AdminPaymentLogsTable(props: AdminPaymentLogsTableProps): ReactElement {
  const [selectedRow, setSelectedRow] = useState<PaymentLogAdminRow | null>(null);
  const columns = useMemo(
    () => [
      columnHelper.accessor('receivedAtIso', {
        header: 'Received (PH)',
        cell: (info) => DATE_TIME_FORMATTER.format(new Date(info.getValue())),
      }),
      columnHelper.accessor('gatewayLabel', {
        header: 'Gateway',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('outcome', {
        header: 'Outcome',
        cell: (info) => (
          <Badge variant={resolveOutcomeBadgeVariant(info.getValue())} className="capitalize">
            {formatOutcomeLabel(info.getValue())}
          </Badge>
        ),
      }),
      columnHelper.accessor('httpStatus', {
        header: 'HTTP',
        cell: (info) => <span className="font-mono text-xs tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'customer',
        header: 'Customer',
        cell: (info) => {
          const summary = formatCustomer(info.row.original);
          return (
            <span className="line-clamp-2 text-xs text-foreground" title={summary}>
              {summary}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: (info) => (
          <span className="font-mono text-xs tabular-nums">{formatStatusTransition(info.row.original)}</span>
        ),
      }),
      columnHelper.accessor('durationMs', {
        header: 'Duration',
        cell: (info) => <span className="font-mono text-xs tabular-nums">{formatDuration(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'details',
        header: 'Details',
        cell: (info) => {
          const summary = formatDetailSummary(info.row.original);
          return (
            <span className="line-clamp-2 text-xs text-muted-foreground" title={summary}>
              {summary}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedRow(info.row.original)}>
            View
          </Button>
        ),
      }),
    ],
    [],
  );
  return (
    <>
      <DataTable
        columns={columns}
        data={[...props.initialData]}
        emptyMessage="No payment logs yet. Entries appear here after gateways POST to /api/webhooks/*."
        resolveRowClassName={(row) =>
          row.outcome === 'updated' || row.outcome === 'noop' ? undefined : 'bg-destructive/5'
        }
      />
      <PaymentLogDetailDialog row={selectedRow} onClose={() => setSelectedRow(null)} />
    </>
  );
}
