'use client';

import Link from 'next/link';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ClipboardList, Loader2, Search } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import { AccountDiagnosticsBookingStatusBadge } from '@/components/marketing/account-diagnostics-booking-status-badge';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountDiagnosticsSessionActionsBar } from '@/components/marketing/account-diagnostics-session-actions-bar';
import {
  buildSessionManageHref,
  isSessionAwaitingPayment,
  resolveAccountDiagnosticsSessionActions,
} from '@/lib/marketing/account-diagnostics-session-actions';
import {
  resolveAccountDiagnosticListSummary,
  resolveAccountDiagnosticListTitle,
} from '@/lib/marketing/quiz-session-list-display';
import type {
  BookingListStatusFilter,
  VisitorQuizSessionSummary,
} from '@/lib/data/quiz-session-types';
import { BOOKING_LIST_STATUS_FILTER_OPTIONS } from '@/lib/marketing/account-booking-status';
import { resolveAccountBookingStatusFromSummary } from '@/lib/marketing/account-booking-status';
import { shouldShowAccountDiagnosticsScheduledSession } from '@/lib/marketing/account-diagnostics-booking-status';
import { cn } from '@/lib/utils';

const MOBILE_LIST_ITEM_ESTIMATE_PX = 108;
const MOBILE_STICKY_TOOLBAR_TOP_CLASS = 'top-14';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

const STATUS_TAB_OPTIONS = BOOKING_LIST_STATUS_FILTER_OPTIONS;


function resolveMobileStatusLine(row: VisitorQuizSessionSummary): string | null {
  const bookingStatus = resolveAccountBookingStatusFromSummary(row);
  if (bookingStatus === 'completed') {
    return 'Booking completed';
  }
  if (bookingStatus === 'cancelled') {
    return 'Booking cancelled';
  }
  if (bookingStatus === 'awaiting_payment') {
    return 'Awaiting payment';
  }
  if (bookingStatus === 'confirmed') {
    return 'Booking confirmed';
  }
  if (bookingStatus === 'pending') {
    return 'Booking pending';
  }
  if (!row.isDiagnosticComplete && !row.isBooked && row.paymentTransactionStatus === null) {
    return 'Diagnostic in progress';
  }
  return null;
}

function DiagnosticStatusBadge(props: { readonly row: VisitorQuizSessionSummary }): ReactElement {
  const isComplete = props.row.isDiagnosticComplete;
  if (isComplete) {
    return <Badge variant="secondary">Completed</Badge>;
  }
  return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">In progress</Badge>;
}

export type AccountDiagnosticsMobileProps = {
  readonly sessions: readonly VisitorQuizSessionSummary[];
  readonly statusFilter: BookingListStatusFilter;
  readonly bookingReferenceInput: string;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly hasMore: boolean;
  readonly totalCount: number;
  readonly manageBookingEnabled: boolean;
  /** When false, infinite-scroll load-more is disabled (desktop table owns pagination). */
  readonly enableInfiniteScroll: boolean;
  readonly onStatusFilterChange: (value: BookingListStatusFilter) => void;
  readonly onBookingReferenceInputChange: (value: string) => void;
  readonly onLoadMore: () => void;
};

export function AccountDiagnosticsMobile(props: AccountDiagnosticsMobileProps): ReactElement {
  const {
    sessions,
    statusFilter,
    bookingReferenceInput,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    manageBookingEnabled,
    onStatusFilterChange,
    onBookingReferenceInputChange,
    enableInfiniteScroll,
    onLoadMore,
  } = props;
  const [selectedSession, setSelectedSession] = useState<VisitorQuizSessionSummary | null>(null);
  const listAnchorRef = useRef<HTMLDivElement>(null);
  const loadMoreRequestedRef = useRef(false);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowCount = sessions.length + (hasMore ? 1 : 0);
  const virtualizer = useWindowVirtualizer({
    count: isLoading && sessions.length === 0 ? 6 : rowCount,
    estimateSize: () => MOBILE_LIST_ITEM_ESTIMATE_PX,
    overscan: 6,
    scrollMargin,
  });
  const measureScrollMargin = useCallback((): void => {
    if (listAnchorRef.current === null) {
      return;
    }
    setScrollMargin(listAnchorRef.current.offsetTop);
  }, []);
  useEffect(() => {
    measureScrollMargin();
    window.addEventListener('resize', measureScrollMargin);
    return () => window.removeEventListener('resize', measureScrollMargin);
  }, [measureScrollMargin, statusFilter, bookingReferenceInput]);
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    loadMoreRequestedRef.current = false;
  }, [statusFilter, bookingReferenceInput]);
  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreRequestedRef.current = false;
    }
  }, [isLoadingMore]);
  useEffect(() => {
    if (!enableInfiniteScroll || isLoading || isLoadingMore || !hasMore || sessions.length === 0) {
      return;
    }
    const lastVirtualItem = virtualItems.at(-1);
    if (lastVirtualItem === undefined) {
      return;
    }
    if (lastVirtualItem.index >= sessions.length - 1 && !loadMoreRequestedRef.current) {
      loadMoreRequestedRef.current = true;
      onLoadMore();
    }
  }, [enableInfiniteScroll, hasMore, isLoading, isLoadingMore, onLoadMore, sessions.length, virtualItems]);
  const handleOpenSession = useCallback((row: VisitorQuizSessionSummary): void => {
    setSelectedSession(row);
  }, []);
  const handleCloseDialog = useCallback((open: boolean): void => {
    if (!open) {
      setSelectedSession(null);
    }
  }, []);
  return (
    <div className="md:hidden">
      <div
        className={cn(
          'sticky z-40 space-y-3 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80',
          MOBILE_STICKY_TOOLBAR_TOP_CLASS,
        )}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">My diagnostics</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="booking-reference-search-mobile"
            value={bookingReferenceInput}
            onChange={(event) => onBookingReferenceInputChange(event.target.value)}
            placeholder="Search by booking reference"
            className="h-10 pl-9"
            aria-label="Search by booking reference"
          />
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter by booking status"
        >
          {STATUS_TAB_OPTIONS.map((option) => {
            const isActive = statusFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={isLoading && sessions.length === 0}
                onClick={() => onStatusFilterChange(option.id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/70 text-foreground hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            Loading sessions…
          </span>
        ) : totalCount === 0 ? (
          'No sessions match your filters'
        ) : (
          <>
            <span className="font-medium text-foreground">{totalCount}</span> session
            {totalCount === 1 ? '' : 's'}
          </>
        )}
      </p>
      <div ref={listAnchorRef} className="relative w-full px-4">
        {isLoading && sessions.length > 0 ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            <span className="sr-only">Loading sessions</span>
          </div>
        ) : null}
        <div
          className="relative w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualItem) => {
            const isLoaderRow = virtualItem.index >= sessions.length;
            const row = sessions[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{
                  transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                }}
              >
                {isLoading && sessions.length === 0 ? (
                  <MobileDiagnosticsListSkeleton />
                ) : isLoaderRow ? (
                  <MobileDiagnosticsLoadMoreRow isLoadingMore={isLoadingMore} hasMore={hasMore} />
                ) : row !== undefined ? (
                  <MobileDiagnosticsListItem row={row} onOpen={handleOpenSession} />
                ) : null}
              </div>
            );
          })}
        </div>
        {!isLoading && sessions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No sessions on this page. Try another filter or search term.</p>
        ) : null}
      </div>
      <MobileDiagnosticsSessionDialog
        session={selectedSession}
        manageBookingEnabled={manageBookingEnabled}
        onOpenChange={handleCloseDialog}
      />
    </div>
  );
}

function MobileDiagnosticsListItem(props: {
  readonly row: VisitorQuizSessionSummary;
  readonly onOpen: (row: VisitorQuizSessionSummary) => void;
}): ReactElement {
  const statusLine = resolveMobileStatusLine(props.row);
  const title = resolveAccountDiagnosticListTitle(props.row);
  const summaryLine = resolveAccountDiagnosticListSummary(props.row);
  const rightLabel =
    props.row.bookingReferenceId ??
    (props.row.paymentTransactionStatus === 'paid' ? 'Paid' : props.row.isDiagnosticComplete ? 'Done' : null);
  return (
    <button
      type="button"
      onClick={() => props.onOpen(props.row)}
      className={cn(
        'group mb-2 flex w-full min-h-11 gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-3.5 text-left shadow-xs',
        'transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out',
        'hover:border-primary/30 hover:bg-muted/55 hover:shadow-md hover:ring-1 hover:ring-primary/20',
        'active:scale-[0.99] active:bg-muted/70 active:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'motion-reduce:transition-none motion-reduce:active:scale-100',
        'dark:border-border/50 dark:bg-card/35 dark:hover:bg-muted/40 dark:hover:border-primary/25',
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
          'transition-[background-color,transform] duration-200 ease-out',
          'group-hover:scale-105 group-hover:bg-primary/20',
          'group-active:scale-100',
        )}
      >
        <ClipboardList className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        {statusLine !== null ? <p className="text-xs font-medium text-destructive">{statusLine}</p> : null}
        <p className="line-clamp-2 text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-foreground">
          {title}
        </p>
        {summaryLine !== null ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{summaryLine}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">{DATE_TIME_FORMATTER.format(new Date(props.row.updatedAtIso))}</p>
        <span
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary',
            'transition-[color,transform] duration-200 ease-out group-hover:gap-1.5',
          )}
        >
          View details
          <ChevronRight
            className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
      {rightLabel !== null ? (
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">{rightLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Step {props.row.currentStep}</p>
        </div>
      ) : null}
    </button>
  );
}

function MobileDiagnosticsListSkeleton(): ReactElement {
  return (
    <div className="mb-2 space-y-3 rounded-xl border border-border/60 bg-card/50 px-3 py-3.5 shadow-xs">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

function MobileDiagnosticsLoadMoreRow(props: { readonly isLoadingMore: boolean; readonly hasMore: boolean }): ReactElement {
  if (!props.hasMore) {
    return <p className="py-6 text-center text-xs text-muted-foreground">End of list</p>;
  }
  return (
    <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground" aria-live="polite">
      {props.isLoadingMore ? (
        <>
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          Loading more…
        </>
      ) : (
        'Scroll for more'
      )}
    </p>
  );
}

type MobileDiagnosticsSessionDialogProps = {
  readonly session: VisitorQuizSessionSummary | null;
  readonly manageBookingEnabled: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

function MobileDiagnosticsSessionDialog(props: MobileDiagnosticsSessionDialogProps): ReactElement {
  const session = props.session;
  const sessionActions = session !== null ? resolveAccountDiagnosticsSessionActions(session) : [];
  const showManageOnBookingTab = sessionActions.includes('manage');
  const bookingTitle = useMemo(() => {
    if (session === null) {
      return 'Consultation';
    }
    const serviceKey = session.bookingServiceKey ?? session.checkoutServiceKey;
    return serviceKey === 'project-rescue' ? PROJECT_RESCUE_SERVICE_TITLE : serviceKey ?? 'Consultation';
  }, [session]);
  const slotFormatter = useMemo(() => {
    if (session === null) {
      return null;
    }
    const timezone = session.bookingTimezone ?? session.checkoutTimezone;
    if (timezone === null) {
      return null;
    }
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    });
  }, [session]);
  const startsAtIso = session?.bookingStartsAtIso ?? session?.checkoutStartsAtIso ?? null;
  return (
    <Dialog open={session !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border px-4 py-4 pr-12 text-left">
          <DialogTitle className="line-clamp-2 text-base leading-snug">
            {session !== null ? resolveAccountDiagnosticListTitle(session) : 'Session details'}
          </DialogTitle>
          <DialogDescription>
            {session !== null ? DATE_TIME_FORMATTER.format(new Date(session.updatedAtIso)) : null}
          </DialogDescription>
        </DialogHeader>
        {session !== null ? (
          <Tabs defaultValue="diagnostic" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)] shrink-0">
              <TabsTrigger value="diagnostic" className="flex-1">
                Diagnostic detail
              </TabsTrigger>
              <TabsTrigger value="booking" className="flex-1">
                Booking details
              </TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="diagnostic" className="mt-0 space-y-4 pt-4">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Diagnostic status</dt>
                    <dd className="mt-1">
                      <DiagnosticStatusBadge row={session} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current step</dt>
                    <dd className="mt-1 font-medium tabular-nums text-foreground">{session.currentStep}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last updated</dt>
                    <dd className="mt-1 text-foreground">{DATE_TIME_FORMATTER.format(new Date(session.updatedAtIso))}</dd>
                  </div>
                  {session.sessionTitlePreview !== null && session.sessionTitlePreview.length > 0 ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Session</dt>
                      <dd className="mt-1 font-medium text-foreground">{session.sessionTitlePreview}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</dt>
                    <dd className="mt-1 text-foreground">
                      {session.situationPreview !== null && session.situationPreview.length > 0
                        ? session.situationPreview
                        : session.hasGuidedDiagnostic
                          ? 'Guided diagnostic'
                          : '—'}
                    </dd>
                  </div>
                  {session.situationLabel !== null &&
                  session.situationLabel.length > 0 &&
                  session.situationLabel !== session.situationPreview ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</dt>
                      <dd className="mt-1">
                        <Badge variant="secondary" className="font-normal">
                          {session.situationLabel}
                        </Badge>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <AccountDiagnosticsSessionActionsBar
                  row={session}
                  manageBookingEnabled={props.manageBookingEnabled}
                  viewLabel="View diagnostic"
                />
              </TabsContent>
              <TabsContent value="booking" className="mt-0 space-y-4 pt-4">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking reference</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold tracking-wider text-foreground">
                      {session.bookingReferenceId ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booking status</dt>
                    <dd className="mt-1">
                      <AccountDiagnosticsBookingStatusBadge row={session} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Service</dt>
                    <dd className="mt-1 text-foreground">{bookingTitle}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled session</dt>
                    <dd className="mt-1 text-foreground">
                      {shouldShowAccountDiagnosticsScheduledSession(session) &&
                      startsAtIso !== null &&
                      slotFormatter !== null
                        ? slotFormatter.format(new Date(startsAtIso))
                        : '—'}
                    </dd>
                  </div>
                  {session.bookingMeetingUrl !== null ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Meeting link</dt>
                      <dd className="mt-1">
                        <a
                          href={session.bookingMeetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Join video meeting
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {session.bookingStatus === 'confirmed' && startsAtIso !== null ? (
                  <AddToCalendarButtons
                    startsAtIso={startsAtIso}
                    title={bookingTitle}
                    description={
                      session.bookingReferenceId !== null
                        ? `Booking reference ${session.bookingReferenceId}. Account diagnostics.`
                        : 'Account diagnostics.'
                    }
                    location={session.bookingMeetingUrl ?? undefined}
                    icsUidSeed={session.bookingReferenceId ?? startsAtIso}
                  />
                ) : session.paymentTransactionStatus === 'paid' && session.bookingStatus === null ? (
                  <p className="text-xs text-muted-foreground">Booking confirmation in progress</p>
                ) : null}
                {showManageOnBookingTab ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" asChild>
                      <Link href={buildSessionManageHref(session, props.manageBookingEnabled)}>
                        {isSessionAwaitingPayment(session) ? 'Complete payment' : 'Manage booking'}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </TabsContent>
            </div>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
