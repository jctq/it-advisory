'use client';

import { Calendar, CalendarCheck2, CalendarClock, CalendarX2, Inbox, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import {
  AdminBookingsCalendar,
  type AdminBookingsCalendarFocusRequest,
  type AdminBookingsCalendarNavigateRequest,
} from '@/components/admin/admin-bookings-calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl } from '@/lib/config/build-api-url';
import {
  resolveManilaTodayYmd,
  resolveManilaYmdRangeFromCalendarVisibleRange,
} from '@/lib/admin/admin-bookings-calendar-range';
import type {
  AdminBookingCalendarRow,
  AdminBookingCalendarStatusCounts,
} from '@/lib/data/bookings';
import { formatBookingReferenceId, normalizeBookingReferenceInput } from '@/lib/marketing/booking-reference';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { cn } from '@/lib/utils';

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

const EMPTY_COUNTS: AdminBookingCalendarStatusCounts = {
  all: 0,
  confirmed: 0,
  pending: 0,
  cancelled: 0,
};

type ReferenceSearchFeedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'success';
      readonly message: string;
      readonly bookingId: string;
      readonly bookingReference: string;
    };

type AdminBookingsListResponse = {
  readonly bookings: readonly AdminBookingCalendarRow[];
  readonly countsByStatus: AdminBookingCalendarStatusCounts;
};

type AdminBookingsReferenceResponse = {
  readonly booking: AdminBookingCalendarRow;
};

function resolveStatusCount(
  counts: AdminBookingCalendarStatusCounts,
  filter: BookingStatusFilter,
): number {
  if (filter === 'all') {
    return counts.all;
  }
  return counts[filter];
}

/**
 * Admin bookings page layout: status sidebar, date range filter, API-backed calendar.
 */
export function AdminBookingsWorkspace(): ReactElement {
  const todayYmd = resolveManilaTodayYmd();
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('confirmed');
  const [rangeFromYmd, setRangeFromYmd] = useState(todayYmd);
  const [rangeToYmd, setRangeToYmd] = useState(todayYmd);
  const [draftFromYmd, setDraftFromYmd] = useState(todayYmd);
  const [draftToYmd, setDraftToYmd] = useState(todayYmd);
  const [bookings, setBookings] = useState<readonly AdminBookingCalendarRow[]>([]);
  const [countsByStatus, setCountsByStatus] = useState<AdminBookingCalendarStatusCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [referenceQuery, setReferenceQuery] = useState('');
  const [referenceFeedback, setReferenceFeedback] = useState<ReferenceSearchFeedback>({
    kind: 'idle',
  });
  const [isReferenceSearching, setIsReferenceSearching] = useState(false);
  const [focusRequest, setFocusRequest] = useState<AdminBookingsCalendarFocusRequest | null>(null);
  const [navigateRequest, setNavigateRequest] = useState<AdminBookingsCalendarNavigateRequest | null>(
    null,
  );
  const [focusToken, setFocusToken] = useState(0);
  const [navigateToken, setNavigateToken] = useState(0);
  const activeFilterLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.label ?? 'All bookings';
  const executeVisibleRangeChange = useCallback((start: Date, end: Date): void => {
    const { fromYmd, toYmd } = resolveManilaYmdRangeFromCalendarVisibleRange(start, end);
    setRangeFromYmd((previous) => (previous === fromYmd ? previous : fromYmd));
    setRangeToYmd((previous) => (previous === toYmd ? previous : toYmd));
    setDraftFromYmd((previous) => (previous === fromYmd ? previous : fromYmd));
    setDraftToYmd((previous) => (previous === toYmd ? previous : toYmd));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function loadBookings(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);
      const params = new URLSearchParams({ from: rangeFromYmd, to: rangeToYmd });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      try {
        const response = await fetch(buildApiUrl(`/api/admin/bookings?${params.toString()}`), {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Request failed (${response.status})`);
        }
        const payload = (await response.json()) as AdminBookingsListResponse;
        setBookings(payload.bookings);
        setCountsByStatus(payload.countsByStatus);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load bookings.';
        setLoadError(message);
        setBookings([]);
        setCountsByStatus(EMPTY_COUNTS);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }
    void loadBookings();
    return () => {
      controller.abort();
    };
  }, [rangeFromYmd, rangeToYmd, statusFilter]);
  const executeApplyDateRange = (): void => {
    if (draftFromYmd.length === 0 || draftToYmd.length === 0 || draftFromYmd > draftToYmd) {
      setLoadError('Choose a valid from date on or before the to date.');
      return;
    }
    setLoadError(null);
    setRangeFromYmd(draftFromYmd);
    setRangeToYmd(draftToYmd);
    const nextToken = navigateToken + 1;
    setNavigateToken(nextToken);
    setNavigateRequest({ fromYmd: draftFromYmd, toYmd: draftToYmd, token: nextToken });
  };
  const executeResetDateRangeToToday = (): void => {
    const nextToday = resolveManilaTodayYmd();
    setDraftFromYmd(nextToday);
    setDraftToYmd(nextToday);
    setRangeFromYmd(nextToday);
    setRangeToYmd(nextToday);
    const nextToken = navigateToken + 1;
    setNavigateToken(nextToken);
    setNavigateRequest({ fromYmd: nextToday, toYmd: nextToday, token: nextToken });
  };
  const executeReferenceSearch = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = referenceQuery.trim();
    if (trimmed.length === 0) {
      setReferenceFeedback({ kind: 'idle' });
      return;
    }
    const normalized = normalizeBookingReferenceInput(trimmed);
    if (normalized.length < 4) {
      setReferenceFeedback({
        kind: 'error',
        message: 'Enter at least four characters of the booking reference.',
      });
      return;
    }
    setIsReferenceSearching(true);
    setReferenceFeedback({ kind: 'idle' });
    try {
      const params = new URLSearchParams({ reference: trimmed });
      const response = await fetch(buildApiUrl(`/api/admin/bookings?${params.toString()}`), {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => null)) as
        | AdminBookingsReferenceResponse
        | { error?: string; matchCount?: number }
        | null;
      if (!response.ok) {
        const message =
          body !== null && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : `Lookup failed (${response.status})`;
        setReferenceFeedback({ kind: 'error', message });
        return;
      }
      const booking = (body as AdminBookingsReferenceResponse).booking;
      const bookingReference = formatBookingReferenceId(booking.id);
      const bookingYmd = new Date(booking.startsAtIso).toLocaleDateString('en-CA', {
        timeZone: PRIMARY_TIMEZONE,
      });
      setBookings((previous) => {
        const exists = previous.some((row) => row.id === booking.id);
        if (exists) {
          return previous;
        }
        return [...previous, booking];
      });
      if (statusFilter !== 'all' && booking.status !== statusFilter) {
        setStatusFilter('all');
      }
      setDraftFromYmd(bookingYmd);
      setDraftToYmd(bookingYmd);
      setRangeFromYmd(bookingYmd);
      setRangeToYmd(bookingYmd);
      const nextNavigateToken = navigateToken + 1;
      setNavigateToken(nextNavigateToken);
      setNavigateRequest({ fromYmd: bookingYmd, toYmd: bookingYmd, token: nextNavigateToken });
      const nextFocusToken = focusToken + 1;
      setFocusToken(nextFocusToken);
      setFocusRequest({
        bookingId: booking.id,
        startsAtIso: booking.startsAtIso,
        token: nextFocusToken,
      });
      setReferenceFeedback({
        kind: 'success',
        message: `Moved calendar to ${new Date(booking.startsAtIso).toLocaleString('en-PH', {
          timeZone: PRIMARY_TIMEZONE,
          dateStyle: 'medium',
          timeStyle: 'short',
        })} (Manila).`,
        bookingId: booking.id,
        bookingReference,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Reference lookup failed.';
      setReferenceFeedback({ kind: 'error', message });
    } finally {
      setIsReferenceSearching(false);
    }
  };
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
              Filter the calendar like mail folders. Counts reflect the selected date range.
            </p>
          </div>
          <nav className="space-y-0.5 p-2" role="navigation">
            {STATUS_FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = statusFilter === option.id;
              const count = resolveStatusCount(countsByStatus, option.id);
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
                    {isLoading ? '…' : count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
      <div data-admin-tour="page-bookings-calendar" className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bookings-range-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="bookings-range-from"
                type="date"
                value={draftFromYmd}
                onChange={(event) => setDraftFromYmd(event.target.value)}
                className="w-[11.5rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bookings-range-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="bookings-range-to"
                type="date"
                value={draftToYmd}
                onChange={(event) => setDraftToYmd(event.target.value)}
                className="w-[11.5rem]"
              />
            </div>
            <Button type="button" variant="secondary" onClick={executeApplyDateRange}>
              Apply range
            </Button>
            <Button type="button" variant="ghost" onClick={executeResetDateRangeToToday}>
              Today
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Date range defaults to today (Manila). Prev/next and view switches load bookings for the
            visible range.
          </p>
        </div>
        <form onSubmit={executeReferenceSearch} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={referenceQuery}
              onChange={(event) => {
                setReferenceQuery(event.target.value);
                if (referenceFeedback.kind !== 'idle') {
                  setReferenceFeedback({ kind: 'idle' });
                }
              }}
              placeholder="Search by reference…"
              className="pl-9"
              aria-label="Search booking by reference"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" variant="secondary" className="shrink-0" disabled={isReferenceSearching}>
            {isReferenceSearching ? 'Searching…' : 'Find on calendar'}
          </Button>
        </form>
        {referenceFeedback.kind === 'error' ? (
          <p className="text-sm text-destructive" role="alert">
            {referenceFeedback.message}
          </p>
        ) : null}
        {referenceFeedback.kind === 'success' ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{referenceFeedback.bookingReference}</span>
            {' — '}
            {referenceFeedback.message}{' '}
            <Link
              href={`/admin/bookings/${referenceFeedback.bookingId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open booking
            </Link>
          </p>
        ) : null}
        {loadError !== null ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            'Loading bookings…'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">{bookings.length.toLocaleString()}</span>{' '}
              {bookings.length === 1 ? 'booking' : 'bookings'}
              {statusFilter === 'all' ? '' : ` · ${activeFilterLabel}`}
              {' · '}
              <span className="tabular-nums">
                {rangeFromYmd === rangeToYmd ? rangeFromYmd : `${rangeFromYmd} – ${rangeToYmd}`}
              </span>
            </>
          )}
        </p>
        <AdminBookingsCalendar
          bookings={bookings}
          isLoading={isLoading}
          initialAnchorYmd={todayYmd}
          focusRequest={focusRequest}
          navigateRequest={navigateRequest}
          onVisibleRangeChange={executeVisibleRangeChange}
        />
      </div>
    </div>
  );
}
