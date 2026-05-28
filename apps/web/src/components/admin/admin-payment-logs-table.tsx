'use client';

import { createColumnHelper, type PaginationState } from '@tanstack/react-table';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PAYMENT_GATEWAY_IDS, type PaymentGatewayId } from '@/domain/payment-types';
import { PAYMENT_LOG_OUTCOMES, type PaymentLogOutcome } from '@/domain/payment-log-types';
import { useAdminPaymentLogsQuery } from '@/hooks/admin/use-admin-payment-logs-query';
import {
  ADMIN_DEBUG_SEARCH_DEBOUNCE_MS,
  ADMIN_DEBUG_TABLE_PAGE_SIZE,
} from '@/lib/admin/admin-paginated-list';
import type {
  PaymentLogAdminRow,
  PaymentLogListGatewayFilter,
  PaymentLogListOutcomeFilter,
} from '@/lib/data/payment-logs';

type AdminPaymentLogsTableProps = {
  readonly isActive: boolean;
};

const columnHelper = createColumnHelper<PaymentLogAdminRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

const GATEWAY_LABELS: Record<PaymentGatewayId, string> = {
  paymongo: 'PayMongo',
  xendit: 'Xendit',
  hitpay: 'HitPay',
  paypal: 'PayPal',
};

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
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<PaymentLogListOutcomeFilter>('all');
  const [gatewayFilter, setGatewayFilter] = useState<PaymentLogListGatewayFilter>('all');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: ADMIN_DEBUG_TABLE_PAGE_SIZE,
  });
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, ADMIN_DEBUG_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);
  useEffect(() => {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }, [debouncedSearch, gatewayFilter, outcomeFilter]);
  const queryFilters = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: debouncedSearch,
      outcome: outcomeFilter,
      gatewayId: gatewayFilter,
    }),
    [debouncedSearch, gatewayFilter, outcomeFilter, pagination.pageIndex, pagination.pageSize],
  );
  const query = useAdminPaymentLogsQuery(queryFilters, props.isActive);
  const rows = query.data?.rows ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && pagination.pageIndex >= totalPages) {
      setPagination((previous) => ({ ...previous, pageIndex: totalPages - 1 }));
    }
  }, [pagination.pageIndex, totalPages]);
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
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
          <div className="space-y-2">
            <Label htmlFor="admin-payment-logs-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="admin-payment-logs-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Email, session id, transaction, booking"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-payment-logs-outcome">Outcome</Label>
            <NativeSelect
              id="admin-payment-logs-outcome"
              value={outcomeFilter}
              onChange={(event) => setOutcomeFilter(event.target.value as PaymentLogListOutcomeFilter)}
            >
              <option value="all">All outcomes</option>
              {PAYMENT_LOG_OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {formatOutcomeLabel(outcome)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-payment-logs-gateway">Gateway</Label>
            <NativeSelect
              id="admin-payment-logs-gateway"
              value={gatewayFilter}
              onChange={(event) => setGatewayFilter(event.target.value as PaymentLogListGatewayFilter)}
            >
              <option value="all">All gateways</option>
              {PAYMENT_GATEWAY_IDS.map((gatewayId) => (
                <option key={gatewayId} value={gatewayId}>
                  {GATEWAY_LABELS[gatewayId]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {query.error !== null ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {query.error.message}
          </p>
        ) : null}
        <DataTable
          columns={columns}
          data={[...rows]}
          emptyMessage="No payment logs matched your filters."
          resolveRowClassName={(row) =>
            row.outcome === 'updated' || row.outcome === 'noop' ? undefined : 'bg-destructive/5'
          }
          manualPagination
          pageCount={Math.max(1, totalPages)}
          totalCount={totalCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={query.isLoading}
        />
      </div>
      <PaymentLogDetailDialog row={selectedRow} onClose={() => setSelectedRow(null)} />
    </>
  );
}
