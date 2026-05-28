'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/admin/data-table';
import { resolveAdminBookingCalendarEventTitle } from '@/lib/admin/resolve-admin-booking-calendar-event-title';
import type { AdminBookingCalendarRow } from '@/lib/data/bookings';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type AdminBookingsTableProps = {
  readonly bookings: readonly AdminBookingCalendarRow[];
  readonly isLoading: boolean;
  readonly highlightedBookingId: string | null;
};

const columnHelper = createColumnHelper<AdminBookingCalendarRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: PRIMARY_TIMEZONE,
});

function resolveStatusBadgeVariant(
  status: AdminBookingCalendarRow['status'],
): 'default' | 'secondary' | 'outline' {
  if (status === 'confirmed') {
    return 'default';
  }
  if (status === 'pending') {
    return 'secondary';
  }
  return 'outline';
}

function resolveContactEmail(booking: AdminBookingCalendarRow): string | null {
  if (booking.contactEmail !== null && booking.contactEmail.length > 0) {
    return booking.contactEmail;
  }
  if (booking.accountEmail !== null && booking.accountEmail.length > 0) {
    return booking.accountEmail;
  }
  return null;
}

/**
 * Sortable table of admin calendar bookings for the selected date range and filters.
 */
export function AdminBookingsTable(props: AdminBookingsTableProps): ReactElement {
  const sortedBookings = useMemo(() => {
    return [...props.bookings].sort((left, right) => right.startsAtIso.localeCompare(left.startsAtIso));
  }, [props.bookings]);
  const columns = useMemo(
    () => [
      columnHelper.accessor('startsAtIso', {
        header: 'Starts (PH)',
        cell: (info) => (
          <span className="whitespace-nowrap tabular-nums">
            {DATE_TIME_FORMATTER.format(new Date(info.getValue()))}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'reference',
        header: 'Reference',
        cell: (info) => {
          const booking = info.row.original;
          const reference = formatBookingReferenceId(booking.id);
          return (
            <Link
              href={`/admin/bookings/${booking.id}`}
              className="font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {reference}
            </Link>
          );
        },
      }),
      columnHelper.display({
        id: 'title',
        header: 'Title',
        cell: (info) => {
          const title = resolveAdminBookingCalendarEventTitle(info.row.original);
          return (
            <span className="line-clamp-2 font-medium text-foreground" title={title}>
              {title}
            </span>
          );
        },
      }),
      columnHelper.accessor('contactName', {
        header: 'Contact',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'email',
        header: 'Email',
        cell: (info) => {
          const email = resolveContactEmail(info.row.original);
          if (email === null) {
            return <span className="text-muted-foreground">—</span>;
          }
          return <span className="text-muted-foreground">{email}</span>;
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge variant={resolveStatusBadgeVariant(info.getValue())} className="capitalize">
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('quizSessionId', {
        header: 'Session',
        cell: (info) => {
          const sessionId = info.getValue();
          if (sessionId === null || sessionId.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link
              href={`/admin/sessions/${sessionId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              View
            </Link>
          );
        },
      }),
    ],
    [],
  );
  return (
    <div className="relative space-y-4" data-admin-tour="page-bookings-table">
      {props.isLoading ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-card/50 pt-8"
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
        data={sortedBookings}
        emptyMessage="No bookings in this range."
        resolveRowClassName={(row) =>
          props.highlightedBookingId === row.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/25' : undefined
        }
      />
    </div>
  );
}
