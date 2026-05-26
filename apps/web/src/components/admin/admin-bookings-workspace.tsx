'use client';

import { Calendar, CalendarCheck2, CalendarClock, CalendarX2, Inbox } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { AdminBookingsCalendar } from '@/components/admin/admin-bookings-calendar';
import type { AdminBookingCalendarRow } from '@/lib/data/bookings';
import { cn } from '@/lib/utils';

export type AdminBookingsWorkspaceProps = {
  readonly bookings: readonly AdminBookingCalendarRow[];
};

type BookingStatusFilter = 'all' | AdminBookingCalendarRow['status'];

type StatusFilterOption = {
  readonly id: BookingStatusFilter;
  readonly label: string;
  readonly icon: typeof Inbox;
  readonly swatchClassName: string;
};

const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { id: 'all', label: 'All bookings', icon: Inbox, swatchClassName: 'bg-foreground/25' },
  {
    id: 'confirmed',
    label: 'Confirmed',
    icon: CalendarCheck2,
    swatchClassName: 'bg-primary',
  },
  {
    id: 'pending',
    label: 'Pending',
    icon: CalendarClock,
    swatchClassName:
      'border border-[var(--booking-pending-border)] bg-[var(--booking-pending-bg)]',
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    icon: CalendarX2,
    swatchClassName: 'bg-muted-foreground/50',
  },
] as const;

function countBookingsByStatus(
  bookings: readonly AdminBookingCalendarRow[],
  filter: BookingStatusFilter,
): number {
  if (filter === 'all') {
    return bookings.length;
  }
  return bookings.filter((booking) => booking.status === filter).length;
}

function filterBookingsByStatus(
  bookings: readonly AdminBookingCalendarRow[],
  filter: BookingStatusFilter,
): readonly AdminBookingCalendarRow[] {
  if (filter === 'all') {
    return bookings;
  }
  return bookings.filter((booking) => booking.status === filter);
}

/**
 * Admin bookings page layout: email-style status sidebar + filtered calendar.
 */
export function AdminBookingsWorkspace(props: AdminBookingsWorkspaceProps): ReactElement {
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('confirmed');
  const filteredBookings = useMemo(
    () => filterBookingsByStatus(props.bookings, statusFilter),
    [props.bookings, statusFilter],
  );
  const activeFilterLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.label ?? 'All bookings';
  return (
    <div className="fc-admin-bookings flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        data-admin-tour="page-bookings-filters"
        className="w-full shrink-0 lg:sticky lg:top-24 lg:w-60 xl:w-64"
        aria-label="Booking status filters"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Status
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Filter the calendar like mail folders. Click an event for details.
            </p>
          </div>
          <nav className="space-y-0.5 p-2" role="navigation">
            {STATUS_FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = statusFilter === option.id;
              const count = countBookingsByStatus(props.bookings, option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatusFilter(option.id)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    isActive
                      ? 'bg-primary/10 text-foreground ring-1 ring-primary/25'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={cn('size-2.5 shrink-0 rounded-sm', option.swatchClassName)}
                    aria-hidden
                  />
                  <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs tabular-nums',
                      isActive
                        ? 'bg-primary/15 font-semibold text-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
      <div data-admin-tour="page-bookings-calendar" className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">
            {filteredBookings.length.toLocaleString()}
          </span>{' '}
          {filteredBookings.length === 1 ? 'booking' : 'bookings'}
          {statusFilter === 'all' ? '' : ` · ${activeFilterLabel}`}
        </p>
        <AdminBookingsCalendar bookings={filteredBookings} />
      </div>
    </div>
  );
}
