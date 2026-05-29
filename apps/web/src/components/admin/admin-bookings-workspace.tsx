'use client';

import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CircleCheckBig,
  CircleHelp,
  Inbox,
  Search,
  Table2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import {
  AdminBookingsCalendar,
  type AdminBookingsCalendarFocusRequest,
  type AdminBookingsCalendarNavigateRequest,
} from '@/components/admin/admin-bookings-calendar';
import { AdminBookingsTable } from '@/components/admin/admin-bookings-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  BOOKING_LIST_STATUS_FILTER_OPTIONS,
  resolveAdminBookingLifecycleStatus,
  type BookingListStatusFilter,
} from '@/lib/marketing/account-booking-status';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { resolveBookingsViewMode, type BookingsViewMode } from '@/lib/admin/admin-bookings-view';
import { cn } from '@/lib/utils';

type BookingStatusFilter = BookingListStatusFilter;

const HIGHLIGHT_DURATION_MS = 4000;

type StatusFilterOption = {
  readonly id: BookingStatusFilter;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: typeof Inbox;
};

const STATUS_FILTER_ICONS: Record<BookingListStatusFilter, typeof Inbox> = {
  all: Inbox,
  pending: CalendarClock,
  awaiting_payment: CalendarClock,
  confirmed: CalendarCheck2,
  completed: CircleCheckBig,
  cancelled: CalendarX2,
};

const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = BOOKING_LIST_STATUS_FILTER_OPTIONS.map(
  (option) => ({
    id: option.id,
    label: option.id === 'all' ? 'All bookings' : option.label,
    shortLabel: option.label,
    icon: STATUS_FILTER_ICONS[option.id],
  }),
);

const EMPTY_COUNTS: AdminBookingCalendarStatusCounts = {
  all: 0,
  confirmed: 0,
  pending: 0,
  awaiting_payment: 0,
  cancelled: 0,
  completed: 0,
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

type AdminBookingsWorkspaceProps = {
  readonly initialViewMode: BookingsViewMode;
};

/**
 * Admin bookings page layout: date range, reference search, status filters, API-backed calendar.
 */
export function AdminBookingsWorkspace(props: AdminBookingsWorkspaceProps): ReactElement {
  const router = useRouter();
  const todayYmd = resolveManilaTodayYmd();
  const [viewMode, setViewMode] = useState<BookingsViewMode>(props.initialViewMode);
  if (props.initialViewMode !== viewMode) {
    setViewMode(props.initialViewMode);
  }
  const executeChangeViewMode = useCallback(
    (nextViewMode: BookingsViewMode): void => {
      setViewMode(nextViewMode);
      const nextParams = new URLSearchParams(window.location.search);
      if (nextViewMode === 'table') {
        nextParams.delete('view');
      } else {
        nextParams.set('view', nextViewMode);
      }
      const query = nextParams.toString();
      router.replace(query.length > 0 ? `/admin/bookings?${query}` : '/admin/bookings', { scroll: false });
    },
    [router],
  );
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
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const activeFilterLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.label ?? 'All bookings';
  const hasPendingDateRange = draftFromYmd !== rangeFromYmd || draftToYmd !== rangeToYmd;
  const dateRangeHint =
    viewMode === 'calendar'
      ? 'Defaults to today (Manila). Calendar navigation loads bookings for the visible range.'
      : 'Defaults to today (Manila). Apply loads all bookings between the selected dates.';
  const referenceSubmitLabel =
    isReferenceSearching ? 'Searching…' : viewMode === 'calendar' ? 'Find on calendar' : 'Find booking';
  const executeVisibleRangeChange = useCallback((start: Date, end: Date): void => {
    const { fromYmd, toYmd } = resolveManilaYmdRangeFromCalendarVisibleRange(start, end);
    setRangeFromYmd((previous) => (previous === fromYmd ? previous : fromYmd));
    setRangeToYmd((previous) => (previous === toYmd ? previous : toYmd));
    setDraftFromYmd((previous) => (previous === fromYmd ? previous : fromYmd));
    setDraftToYmd((previous) => (previous === toYmd ? previous : toYmd));
  }, []);
  useEffect(() => {
    if (highlightedBookingId === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      setHighlightedBookingId(null);
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightedBookingId]);
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
      if (
        statusFilter !== 'all' &&
        resolveAdminBookingLifecycleStatus({
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paymentTransactionId: booking.paymentTransactionId,
        }) !== statusFilter
      ) {
        setStatusFilter('all');
      }
      setDraftFromYmd(bookingYmd);
      setDraftToYmd(bookingYmd);
      setRangeFromYmd(bookingYmd);
      setRangeToYmd(bookingYmd);
      setHighlightedBookingId(booking.id);
      if (viewMode === 'calendar') {
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
      }
      const startsAtLabel = new Date(booking.startsAtIso).toLocaleString('en-PH', {
        timeZone: PRIMARY_TIMEZONE,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      setReferenceFeedback({
        kind: 'success',
        message:
          viewMode === 'calendar'
            ? `Moved calendar to ${startsAtLabel} (Manila).`
            : `Found booking at ${startsAtLabel} (Manila).`,
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
    <div className="fc-admin-bookings flex flex-col gap-6">
      <div className="min-w-0 space-y-3">
        <TooltipProvider delayDuration={300}>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
              <p className="min-w-0 text-xs text-muted-foreground sm:text-sm">
                {isLoading ? (
                  'Loading bookings…'
                ) : (
                  <>
                    <span className="font-medium text-foreground">{bookings.length.toLocaleString()}</span>{' '}
                    {bookings.length === 1 ? 'booking' : 'bookings'}
                    {statusFilter === 'all' ? '' : ` · ${activeFilterLabel}`}
                    <span className="hidden sm:inline">
                      {' · '}
                      <span className="tabular-nums">
                        {rangeFromYmd === rangeToYmd ? rangeFromYmd : `${rangeFromYmd} – ${rangeToYmd}`}
                      </span>
                    </span>
                  </>
                )}
              </p>
              <div
                data-admin-tour="page-bookings-view-toggle"
                className="inline-flex shrink-0 rounded-lg border border-border bg-muted/30 p-0.5"
                role="group"
                aria-label="Bookings display"
              >
                {(
                  [
                    { id: 'table' as const, label: 'Table', icon: Table2 },
                    { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
                  ] as const
                ).map((option) => {
                  const Icon = option.icon;
                  const isActive = viewMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => executeChangeViewMode(option.id)}
                      aria-pressed={isActive}
                      className={cn(
                        'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              data-admin-tour="page-bookings-filters"
              className="border-b border-border/80 px-3 py-2"
              role="group"
              aria-label="Filter bookings by status"
            >
              <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_FILTER_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = statusFilter === option.id;
                  const count = resolveStatusCount(countsByStatus, option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setStatusFilter(option.id)}
                      aria-label={`${option.label} (${isLoading ? '…' : count})`}
                      aria-pressed={isActive}
                      className={cn(
                        'inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                        isActive
                          ? 'border-primary/30 bg-primary/10 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      <Icon
                        className={cn('size-3.5 shrink-0', isActive ? 'text-primary' : 'opacity-70')}
                        aria-hidden
                      />
                      <span>{option.shortLabel}</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-px text-[0.6875rem] tabular-nums leading-none',
                          isActive
                            ? 'bg-primary/15 font-semibold text-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                        aria-hidden
                      >
                        {isLoading ? '…' : count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
              <div
                className="flex min-w-0 flex-wrap items-center gap-2"
                role="group"
                aria-label="Booking date range"
              >
                <Input
                  id="bookings-range-from"
                  type="date"
                  value={draftFromYmd}
                  onChange={(event) => setDraftFromYmd(event.target.value)}
                  className="h-9 w-41 shrink-0"
                  aria-label="From date"
                />
                <span className="text-xs text-muted-foreground" aria-hidden>
                  –
                </span>
                <Input
                  id="bookings-range-to"
                  type="date"
                  value={draftToYmd}
                  onChange={(event) => setDraftToYmd(event.target.value)}
                  className="h-9 w-41 shrink-0"
                  aria-label="To date"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={hasPendingDateRange ? 'default' : 'secondary'}
                  onClick={executeApplyDateRange}
                  aria-label={hasPendingDateRange ? 'Apply pending date range' : 'Apply date range'}
                >
                  Apply
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={executeResetDateRangeToToday}>
                  Today
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label="Date range help"
                    >
                      <CircleHelp className="size-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left">
                    {dateRangeHint}
                  </TooltipContent>
                </Tooltip>
              </div>
              <form
                onSubmit={executeReferenceSearch}
                className="flex min-w-0 flex-1 items-center gap-2 lg:ml-auto lg:max-w-md"
              >
                <div className="relative min-w-0 flex-1">
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
                    placeholder="Reference…"
                    className="h-9 pl-9"
                    aria-label="Search booking by reference"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="shrink-0 gap-1 px-2.5 sm:px-3"
                  disabled={isReferenceSearching}
                  aria-label={referenceSubmitLabel}
                >
                  <span className="hidden sm:inline">{referenceSubmitLabel}</span>
                  <ArrowRight className="size-4 sm:hidden" aria-hidden />
                </Button>
              </form>
            </div>
          </div>
        </TooltipProvider>
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
        {viewMode === 'calendar' ? (
          <div data-admin-tour="page-bookings-calendar">
            <AdminBookingsCalendar
              bookings={bookings}
              isLoading={isLoading}
              initialAnchorYmd={todayYmd}
              focusRequest={focusRequest}
              navigateRequest={navigateRequest}
              onVisibleRangeChange={executeVisibleRangeChange}
            />
          </div>
        ) : (
          <div data-admin-tour="page-bookings-table">
            <AdminBookingsTable
              bookings={bookings}
              isLoading={isLoading}
              highlightedBookingId={highlightedBookingId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
