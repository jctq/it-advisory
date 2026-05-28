'use client';

import Link from 'next/link';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ClipboardCopy, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useMarketingAccountDiagnostics } from '@/hooks/marketing/use-marketing-account-diagnostics';
import { useMobileViewport } from '@/hooks/use-mobile-viewport';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountDiagnosticsMobile } from '@/components/marketing/account-diagnostics-mobile';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import {
  ACCOUNT_DIAGNOSTICS_DEFAULT_STATUS,
  ACCOUNT_DIAGNOSTICS_MOBILE_PAGE_SIZE,
  ACCOUNT_DIAGNOSTICS_PAGE_SIZE,
  buildDefaultAccountDiagnosticsListRequest,
  matchesAccountDiagnosticsListRequest,
  type AccountDiagnosticsInitialList,
} from '@/lib/marketing/account-diagnostics-list';
import {
  buildSessionAwaitingPaymentBookHref,
  isSessionAwaitingPayment,
  isSessionConfirmedForManage,
  isSessionPaymentExpiredForManage,
} from '@/lib/marketing/account-diagnostics-session-actions';
import { buildMarketingQuizSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { resolveAccountDiagnosticListTitle } from '@/lib/marketing/quiz-session-list-display';
import type {
  PaginatedVisitorQuizSessionsResult,
  VisitorQuizSessionListStatusFilter,
  VisitorQuizSessionSummary,
} from '@/lib/data/quiz-session-types';
import { cn } from '@/lib/utils';

const QUIZ_SESSION_API_URL = '/api/quiz/session';
const MY_SESSIONS_API_URL = '/api/quiz/my-sessions';
const BOOKING_REFERENCE_DEBOUNCE_MS = 350;

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

const columnHelper = createColumnHelper<VisitorQuizSessionSummary>();

const TABLE_COLUMN_CLASS_NAMES: Record<string, string> = {
  bookingReference: 'w-[10.5rem]',
  diagnosticStatus: 'w-[7.5rem]',
  bookingStatus: 'w-[7.5rem]',
  bookingSession: 'min-w-[14rem]',
  sessionTitlePreview: 'min-w-[11rem]',
  actions: 'min-w-[14rem]',
};

function BookingReferenceCell(props: { readonly row: VisitorQuizSessionSummary }): ReactElement {
  const [copied, setCopied] = useState(false);
  const reference = props.row.bookingReferenceId;
  const paymentStatus = props.row.paymentTransactionStatus;
  if (reference === null) {
    if (paymentStatus === 'paid' || paymentStatus === 'processing') {
      return <span className="text-sm font-medium text-primary">Payment received</span>;
    }
    if (paymentStatus === 'pending') {
      return <span className="text-sm text-muted-foreground">Checkout started</span>;
    }
    return <span className="text-sm text-muted-foreground">Not booked</span>;
  }
  const executeCopy = (): void => {
    if (props.row.bookingId === null) {
      return;
    }
    void navigator.clipboard.writeText(props.row.bookingId).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-1.5">
      <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium text-foreground">{reference}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={copied ? 'Booking reference copied' : 'Copy full booking id'}
        title={copied ? 'Copied' : 'Copy full booking id'}
        onClick={executeCopy}
      >
        <ClipboardCopy className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function DiagnosticStatusBadge(props: { readonly row: VisitorQuizSessionSummary }): ReactElement {
  const isComplete = props.row.isDiagnosticComplete;
  if (isComplete) {
    return <Badge variant="secondary">Completed</Badge>;
  }
  return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">In progress</Badge>;
}

function BookingStatusBadge(props: { readonly row: VisitorQuizSessionSummary }): ReactElement {
  const paymentStatus = props.row.paymentTransactionStatus;
  if (props.row.bookingStatus === null) {
    if (paymentStatus === 'paid') {
      return <Badge className="bg-emerald-600/15 text-emerald-800 hover:bg-emerald-600/15 dark:text-emerald-200">Paid</Badge>;
    }
    if (paymentStatus === 'processing') {
      return (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          Confirming
        </Badge>
      );
    }
    if (paymentStatus === 'pending') {
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
          Awaiting payment
        </Badge>
      );
    }
    if (paymentStatus === 'failed' || paymentStatus === 'expired') {
      return <Badge variant="outline">Payment {paymentStatus}</Badge>;
    }
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
        Pending
      </Badge>
    );
  }
  if (props.row.bookingStatus === 'confirmed') {
    return <Badge variant="secondary">Confirmed</Badge>;
  }
  if (props.row.bookingStatus === 'cancelled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  if (props.row.bookingStatus === 'pending') {
    if (paymentStatus === 'expired' || paymentStatus === 'failed') {
      return <Badge variant="outline">Payment {paymentStatus}</Badge>;
    }
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
        Awaiting payment
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
      Pending
    </Badge>
  );
}

function buildBookManageHref(bookingId: string | null): string {
  if (bookingId !== null && MONGO_OBJECT_ID_HEX.test(bookingId)) {
    return `/book/manage?bookingId=${encodeURIComponent(bookingId)}`;
  }
  return '/book/manage';
}

function hasActiveCheckout(row: VisitorQuizSessionSummary): boolean {
  return (
    row.paymentTransactionStatus === 'paid' ||
    row.paymentTransactionStatus === 'processing' ||
    row.paymentTransactionStatus === 'pending'
  );
}

function SessionActions(props: {
  readonly row: VisitorQuizSessionSummary;
  readonly deletingId: string | null;
  readonly manageBookingEnabled: boolean;
  readonly onRequestDelete: (row: VisitorQuizSessionSummary) => void;
}): ReactElement {
  const awaitingPayment = isSessionAwaitingPayment(props.row);
  const paymentExpiredManage = isSessionPaymentExpiredForManage(props.row);
  const showConfirmedActions = isSessionConfirmedForManage(props.row);
  const canDelete = !props.row.isBooked && !hasActiveCheckout(props.row);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {awaitingPayment ? (
        <>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>View</Link>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href={buildSessionAwaitingPaymentBookHref(props.row)}>Manage</Link>
          </Button>
        </>
      ) : paymentExpiredManage ? (
        <>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>View</Link>
          </Button>
          {props.manageBookingEnabled && props.row.bookingId !== null ? (
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={buildBookManageHref(props.row.bookingId)}>Manage</Link>
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>Manage</Link>
            </Button>
          )}
        </>
      ) : showConfirmedActions ? (
        <>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>View</Link>
          </Button>
          {props.manageBookingEnabled ? (
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={buildBookManageHref(props.row.bookingId)}>Manage</Link>
            </Button>
          ) : null}
        </>
      ) : (
        <Button type="button" size="sm" asChild>
          <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>Continue</Link>
        </Button>
      )}
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={props.deletingId === props.row.marketingSessionRef}
          onClick={() => props.onRequestDelete(props.row)}
        >
          {props.deletingId === props.row.marketingSessionRef ? 'Deleting…' : 'Delete'}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Signed-in user UI: API-paginated, searchable diagnostics list.
 */
export type AccountDiagnosticsPanelProps = {
  readonly manageBookingEnabled?: boolean;
  readonly initialList?: AccountDiagnosticsInitialList;
};

export function AccountDiagnosticsPanel(props: AccountDiagnosticsPanelProps = {}): ReactElement {
  const manageBookingEnabled = props.manageBookingEnabled ?? false;
  const hasServerInitialList =
    props.initialList !== undefined &&
    matchesAccountDiagnosticsListRequest(props.initialList, buildDefaultAccountDiagnosticsListRequest());
  const {
    actionError,
    loadError,
    isLoading,
    sessions,
    totalCount,
    totalPages,
    page,
    hasAnySessions,
    deletingId,
    deleteTarget,
    bookingReferenceInput,
    debouncedBookingReference,
    statusFilter,
    isLoadingMore,
    setSessions,
    setActionError,
    setLoadError,
    setIsLoading,
    setTotalCount,
    setTotalPages,
    setPage,
    setHasAnySessions,
    setDeletingId,
    setDeleteTarget,
    setBookingReferenceInput,
    setDebouncedBookingReference,
    setStatusFilter,
    setIsLoadingMore,
  } = useMarketingAccountDiagnostics({ initialList: props.initialList });
  const isMobileViewport = useMobileViewport();
  const fetchRequestIdRef = useRef(0);
  const skipInitialFetchRef = useRef(hasServerInitialList);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const pageSize = isMobileViewport ? ACCOUNT_DIAGNOSTICS_MOBILE_PAGE_SIZE : ACCOUNT_DIAGNOSTICS_PAGE_SIZE;
  const onNavigateError = useCallback((message: string): void => {
    setActionError(message);
  }, [setActionError]);
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(true, onNavigateError);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedBookingReference(bookingReferenceInput.trim());
    }, BOOKING_REFERENCE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [bookingReferenceInput, setDebouncedBookingReference]);
  useEffect(() => {
    setPage(1);
  }, [debouncedBookingReference, isMobileViewport, setPage, statusFilter]);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, setPage, totalPages]);
  const fetchSessions = useCallback(async (): Promise<void> => {
    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;
    const shouldAppend = isMobileViewport && page > 1;
    if (shouldAppend) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status: statusFilter,
    });
    if (debouncedBookingReference.length > 0) {
      params.set('bookingReference', debouncedBookingReference);
    }
    try {
      const response = await fetch(`${MY_SESSIONS_API_URL}?${params.toString()}`, { credentials: 'include' });
      const payload: unknown = await response.json().catch(() => ({}));
      if (fetchRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Could not load diagnostics.';
        setLoadError(message);
        return;
      }
      const data = payload as PaginatedVisitorQuizSessionsResult;
      if (shouldAppend) {
        setSessions((current) => {
          const existingRefs = new Set(current.map((session) => session.marketingSessionRef));
          const nextSessions = data.sessions.filter((session) => !existingRefs.has(session.marketingSessionRef));
          return [...current, ...nextSessions];
        });
      } else {
        setSessions(data.sessions);
      }
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setHasAnySessions(data.hasAnySessions);
    } catch {
      if (fetchRequestIdRef.current !== requestId) {
        return;
      }
      setLoadError('Network error while loading diagnostics.');
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [
    debouncedBookingReference,
    isMobileViewport,
    page,
    pageSize,
    setHasAnySessions,
    setIsLoading,
    setIsLoadingMore,
    setLoadError,
    setSessions,
    setTotalCount,
    setTotalPages,
    statusFilter,
  ]);
  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    void fetchSessions();
  }, [fetchSessions]);
  const executeDelete = useCallback(
    async (marketingSessionRef: string): Promise<void> => {
      setActionError(null);
      setDeletingId(marketingSessionRef);
      try {
        const response = await fetch(`${QUIZ_SESSION_API_URL}?sessionId=${encodeURIComponent(marketingSessionRef)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'Delete failed.';
          setActionError(message);
          return;
        }
        setDeleteTarget(null);
        await fetchSessions();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchSessions, setActionError, setDeleteTarget, setDeletingId],
  );
  const handleConfirmDelete = useCallback((): void => {
    if (deleteTarget === null) {
      return;
    }
    void executeDelete(deleteTarget.marketingSessionRef);
  }, [deleteTarget, executeDelete]);
  const handleRequestDelete = useCallback((row: VisitorQuizSessionSummary): void => {
    setDeleteTarget({
      marketingSessionRef: row.marketingSessionRef,
      sessionTitlePreview: row.sessionTitlePreview,
      situationPreview: row.situationPreview,
    });
  }, [setDeleteTarget]);
  const tableData = useMemo(() => [...sessions], [sessions]);
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'bookingReference',
        header: 'Booking ref.',
        cell: (info) => <BookingReferenceCell row={info.row.original} />,
      }),
      columnHelper.display({
        id: 'diagnosticStatus',
        header: 'Diagnostic',
        cell: (info) => <DiagnosticStatusBadge row={info.row.original} />,
      }),
      columnHelper.display({
        id: 'bookingStatus',
        header: 'Booking',
        cell: (info) => <BookingStatusBadge row={info.row.original} />,
      }),
      columnHelper.display({
        id: 'bookingSession',
        header: 'Scheduled session',
        cell: (info) => {
          const row = info.row.original;
          const startsAtIso = row.bookingStartsAtIso ?? row.checkoutStartsAtIso;
          const timezone = row.bookingTimezone ?? row.checkoutTimezone;
          const serviceKey = row.bookingServiceKey ?? row.checkoutServiceKey;
          if (startsAtIso === null || timezone === null) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          const slotFormatter = new Intl.DateTimeFormat('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: timezone,
          });
          const title =
            serviceKey === 'project-rescue' ? PROJECT_RESCUE_SERVICE_TITLE : serviceKey ?? 'Consultation';
          return (
            <div className="flex max-w-[18rem] flex-col gap-2">
              <span className="text-xs text-muted-foreground">{slotFormatter.format(new Date(startsAtIso))}</span>
              {row.bookingStatus === 'confirmed' ? (
                <AddToCalendarButtons
                  startsAtIso={startsAtIso}
                  title={title}
                  description={
                    row.bookingReferenceId !== null
                      ? `Booking reference ${row.bookingReferenceId}. Account diagnostics.`
                      : 'Account diagnostics.'
                  }
                  location={row.bookingMeetingUrl ?? undefined}
                  icsUidSeed={row.bookingReferenceId ?? startsAtIso}
                />
              ) : row.paymentTransactionStatus === 'paid' && row.bookingStatus === null ? (
                <span className="text-xs text-muted-foreground">Booking confirmation in progress</span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor('sessionTitlePreview', {
        id: 'sessionTitlePreview',
        header: 'Session',
        cell: (info) => {
          const row = info.row.original;
          const title = info.getValue();
          if (title !== null && title.length > 0) {
            return (
              <span className="line-clamp-2 font-medium text-foreground" title={title}>
                {title}
              </span>
            );
          }
          const fallbackTitle = resolveAccountDiagnosticListTitle(row);
          if (fallbackTitle !== 'Diagnostic session' && fallbackTitle !== 'Guided diagnostic') {
            return (
              <span className="line-clamp-2 text-muted-foreground" title={fallbackTitle}>
                {fallbackTitle}
              </span>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: (info) => (
          <SessionActions
            row={info.row.original}
            deletingId={deletingId}
            manageBookingEnabled={manageBookingEnabled}
            onRequestDelete={handleRequestDelete}
          />
        ),
      }),
    ],
    [deletingId, handleRequestDelete, manageBookingEnabled],
  );
  // TanStack Table returns unstable function references; React Compiler intentionally skips memoizing here.
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is documented as incompatible with compiler memoization
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const hasMoreSessions = page < totalPages;
  const handleStatusFilterChange = (value: VisitorQuizSessionListStatusFilter): void => {
    setStatusFilter(value);
  };
  const handleBookingReferenceInputChange = (value: string): void => {
    setBookingReferenceInput(value);
  };
  const handleLoadMoreSessions = useCallback((): void => {
    if (!isMobileViewport || isLoading || isLoadingMore || !hasMoreSessions) {
      return;
    }
    setPage((current) => current + 1);
  }, [hasMoreSessions, isLoading, isLoadingMore, isMobileViewport, setPage]);
  return (
    <div className="space-y-6">
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this diagnostic?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the diagnostic snapshot and cannot be undone. Scheduled bookings stay on file
              and are not deleted.
              {deleteTarget !== null &&
              ((deleteTarget.sessionTitlePreview !== null && deleteTarget.sessionTitlePreview.length > 0) ||
                (deleteTarget.situationPreview !== null && deleteTarget.situationPreview.length > 0)) ? (
                <span className="mt-2 block rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
                  {deleteTarget.sessionTitlePreview !== null && deleteTarget.sessionTitlePreview.length > 0 ? (
                    <span className="block font-medium">{deleteTarget.sessionTitlePreview}</span>
                  ) : null}
                  {deleteTarget.situationPreview !== null && deleteTarget.situationPreview.length > 0 ? (
                    <span
                      className={
                        deleteTarget.sessionTitlePreview !== null && deleteTarget.sessionTitlePreview.length > 0
                          ? 'mt-1 block text-sm text-muted-foreground'
                          : 'block'
                      }
                    >
                      {deleteTarget.situationPreview}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants(), 'bg-destructive text-white hover:bg-destructive/90')}
              disabled={deletingId !== null}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {deletingId !== null ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card className="gap-0 border-0 bg-transparent py-0 shadow-none md:gap-6 md:border md:border-border/80 md:bg-card md:py-6 md:shadow-sm">
        <CardContent className="space-y-6 px-0 pt-0 md:px-6">
          {actionError !== null ? (
            <p className="mx-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive md:mx-0" role="alert">
              {actionError}
            </p>
          ) : null}
          {loadError !== null ? (
            <p className="mx-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive md:mx-0" role="alert">
              {loadError}
            </p>
          ) : null}
          {!isLoading && !hasAnySessions ? (
            <DiagnosticsEmptyState
              className="mx-4 md:mx-0"
              isNavigating={isNavigating}
              onStart={() => {
                setActionError(null);
                void navigateToNewQuiz();
              }}
            />
          ) : (
            <div className="space-y-4">
              <AccountDiagnosticsMobile
                sessions={sessions}
                statusFilter={statusFilter}
                bookingReferenceInput={bookingReferenceInput}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                hasMore={hasMoreSessions}
                totalCount={totalCount}
                manageBookingEnabled={manageBookingEnabled}
                deletingId={deletingId}
                enableInfiniteScroll={isMobileViewport}
                onStatusFilterChange={handleStatusFilterChange}
                onBookingReferenceInputChange={handleBookingReferenceInputChange}
                onLoadMore={handleLoadMoreSessions}
                onRequestDelete={handleRequestDelete}
              />
              <div className="hidden space-y-4 md:block">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
                <BookingReferenceFilterField value={bookingReferenceInput} onChange={handleBookingReferenceInputChange} />
                <StatusFilterField
                  value={statusFilter}
                  onChange={(value) => handleStatusFilterChange(value as VisitorQuizSessionListStatusFilter)}
                  disabled={isLoading}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {isLoading ? (
                  <DiagnosticsLoadingStatus />
                ) : totalCount === 0 ? (
                  <>
                    No sessions match your filters
                    {statusFilter !== 'all' ? (
                      <>
                        {' '}
                        · <span className="capitalize">{statusFilter}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    Showing <span className="font-medium text-foreground">{rangeStart}</span>–
                    <span className="font-medium text-foreground">{rangeEnd}</span> of{' '}
                    <span className="font-medium text-foreground">{totalCount}</span>
                    {statusFilter !== 'all' ? (
                      <>
                        {' '}
                        · filter: <span className="capitalize text-foreground">{statusFilter}</span>
                      </>
                    ) : null}
                  </>
                )}
              </p>
              <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                {isLoading && sessions.length > 0 ? <DiagnosticsListLoadingOverlay /> : null}
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      {table.getAllLeafColumns().map((column) => (
                        <col key={column.id} className={TABLE_COLUMN_CLASS_NAMES[column.id] ?? undefined} />
                      ))}
                    </colgroup>
                    <thead className="border-b border-border bg-muted/40">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className={cn(
                                'px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                                header.column.id === 'actions' && 'text-right',
                              )}
                            >
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {isLoading && sessions.length === 0 ? (
                        <DiagnosticsTableSkeleton columnCount={columns.length} />
                      ) : table.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            No sessions on this page. Try another filter or search term.
                          </td>
                        </tr>
                      ) : (
                        table.getRowModel().rows.map((row) => (
                          <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className={cn('px-4 py-3.5 align-middle', cell.column.id === 'actions' && 'text-right')}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {!isLoading && totalPages > 1 ? (
                <DiagnosticsPagination
                  page={page}
                  totalPages={totalPages}
                  onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
                />
              ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BookingReferenceFilterField(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="booking-reference-search" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Booking reference
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="booking-reference-search"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Search by reference"
          className="h-10 pl-9"
        />
      </div>
    </div>
  );
}

function StatusFilterField(props: {
  readonly value: VisitorQuizSessionListStatusFilter;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="diagnostic-status-filter" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Booking status
      </Label>
      <NativeSelect
        id="diagnostic-status-filter"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10"
        disabled={props.disabled}
        aria-label="Filter by booking status"
      >
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
        <option value="all">All</option>
      </NativeSelect>
    </div>
  );
}

function DiagnosticsEmptyState(props: {
  readonly isNavigating: boolean;
  readonly onStart: () => void;
  readonly className?: string;
}): ReactElement {
  return (
    <div className={cn('rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center', props.className)}>
      <p className="text-sm font-medium text-foreground">No saved diagnostics yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Start a guided diagnostic to capture your situation and book a session.
      </p>
      <Button type="button" className="mt-5" disabled={props.isNavigating} onClick={props.onStart}>
        {props.isNavigating ? 'Starting…' : 'Start your first diagnostic'}
      </Button>
    </div>
  );
}

function DiagnosticsLoadingStatus(): ReactElement {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
      Loading sessions…
    </span>
  );
}

function DiagnosticsListLoadingOverlay(): ReactElement {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading sessions</span>
    </div>
  );
}

function DiagnosticsTableSkeleton(props: { readonly columnCount: number }): ReactElement {
  return (
    <>
      {Array.from({ length: 4 }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border/80">
          <td colSpan={props.columnCount} className="px-4 py-3.5">
            <Skeleton className="h-5 w-full max-w-md" />
          </td>
        </tr>
      ))}
    </>
  );
}

function DiagnosticsPagination(props: {
  readonly page: number;
  readonly totalPages: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{props.page}</span> of{' '}
        <span className="font-medium text-foreground">{props.totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onPrevious} disabled={props.page <= 1}>
          Previous
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onNext} disabled={props.page >= props.totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}
