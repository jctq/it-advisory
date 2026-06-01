'use client';

import {
  createColumnHelper,
  type OnChangeFn,
  type PaginationState,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BookingRefundRow } from '@/lib/data/booking-refunds';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type AdminRefundsTableProps = {
  readonly rows: readonly BookingRefundRow[];
  readonly isLoading: boolean;
  readonly emptyMessage: string;
  readonly manualPagination: boolean;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly pagination: PaginationState;
  readonly onPaginationChange: OnChangeFn<PaginationState>;
  readonly onMarkRefunded: (row: BookingRefundRow) => void;
};

const columnHelper = createColumnHelper<BookingRefundRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: PRIMARY_TIMEZONE,
});

function formatAmountPhp(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resolveStatusBadgeVariant(
  status: BookingRefundRow['status'],
): 'default' | 'secondary' | 'outline' {
  if (status === 'completed') {
    return 'default';
  }
  if (status === 'awaiting') {
    return 'secondary';
  }
  return 'outline';
}

function formatGatewayLabel(gatewayId: BookingRefundRow['gatewayId']): string {
  if (gatewayId === null) {
    return '—';
  }
  return gatewayId.charAt(0).toUpperCase() + gatewayId.slice(1);
}

/**
 * Paginated table of booking refund requests for admin processing.
 */
export function AdminRefundsTable(props: AdminRefundsTableProps): ReactElement {
  const {
    rows,
    isLoading,
    emptyMessage,
    manualPagination,
    pageCount,
    totalCount,
    pagination,
    onPaginationChange,
    onMarkRefunded,
  } = props;
  const columns = useMemo(
    () => [
      columnHelper.accessor('bookingStartsAtIso', {
        header: 'Starts (PH)',
        cell: (info) => (
          <span className="whitespace-nowrap tabular-nums">
            {DATE_TIME_FORMATTER.format(new Date(info.getValue()))}
          </span>
        ),
      }),
      columnHelper.accessor('bookingReference', {
        header: 'Reference',
        cell: (info) => (
          <Link
            href={`/admin/bookings/${info.row.original.bookingId}`}
            className="font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('customerName', {
        header: 'Contact',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('customerEmail', {
        header: 'Email',
        cell: (info) => {
          const email = info.getValue();
          if (email === null || email.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return <span className="text-muted-foreground">{email}</span>;
        },
      }),
      columnHelper.accessor('requestedAmountCentavos', {
        header: 'Requested',
        cell: (info) => (
          <span className="whitespace-nowrap tabular-nums">{formatAmountPhp(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('refundAmountCentavos', {
        header: 'Refunded',
        cell: (info) => {
          if (info.row.original.status !== 'completed') {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="whitespace-nowrap tabular-nums">{formatAmountPhp(info.getValue())}</span>
          );
        },
      }),
      columnHelper.accessor('gatewayId', {
        header: 'Gateway',
        cell: (info) => (
          <span className="text-muted-foreground">{formatGatewayLabel(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('requestedAtIso', {
        header: 'Requested',
        cell: (info) => (
          <span className="whitespace-nowrap tabular-nums">
            {DATE_TIME_FORMATTER.format(new Date(info.getValue()))}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge variant={resolveStatusBadgeVariant(info.getValue())} className="capitalize">
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) =>
          info.row.original.status === 'awaiting' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onMarkRefunded(info.row.original)}
            >
              Mark refunded
            </Button>
          ) : null,
      }),
    ],
    [onMarkRefunded],
  );
  return (
    <div className="relative min-w-0 space-y-4 p-3">
      {isLoading ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-md bg-card/50 pt-8"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Loading…
          </span>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={[...rows]}
        emptyMessage={emptyMessage}
        manualPagination={manualPagination}
        pageCount={pageCount}
        totalCount={totalCount}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />
    </div>
  );
}
