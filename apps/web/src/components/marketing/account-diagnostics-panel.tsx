'use client';

import Link from 'next/link';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ClipboardCopy, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { AddToCalendarButtons } from '@/components/marketing/add-to-calendar-buttons';
import { buildMarketingQuizSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import type {
  PaginatedVisitorQuizSessionsResult,
  VisitorQuizSessionListStatusFilter,
  VisitorQuizSessionSummary,
} from '@/lib/data/quiz-sessions';
import { cn } from '@/lib/utils';

const QUIZ_SESSION_API_URL = '/api/quiz/session';
const MY_SESSIONS_API_URL = '/api/quiz/my-sessions';
const PAGE_SIZE = 8;
const BOOKING_REFERENCE_DEBOUNCE_MS = 350;

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

const columnHelper = createColumnHelper<VisitorQuizSessionSummary>();

const TABLE_COLUMN_CLASS_NAMES: Record<string, string> = {
  bookingReference: 'w-[10.5rem]',
  updatedAtIso: 'w-[11.5rem]',
  diagnosticStatus: 'w-[7.5rem]',
  bookingStatus: 'w-[7.5rem]',
  bookingSession: 'min-w-[14rem]',
  situationPreview: 'min-w-[12rem]',
  currentStep: 'w-[4.5rem]',
  actions: 'min-w-[14rem]',
};

function BookingReferenceCell(props: { readonly row: VisitorQuizSessionSummary }): ReactElement {
  const [copied, setCopied] = useState(false);
  const reference = props.row.bookingReferenceId;
  if (reference === null) {
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
  const isComplete = props.row.completedAtIso !== null;
  if (isComplete) {
    return <Badge variant="secondary">Completed</Badge>;
  }
  return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">In progress</Badge>;
}

function BookingStatusBadge(props: { readonly row: VisitorQuizSessionSummary }): ReactElement {
  if (props.row.bookingStatus === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (props.row.bookingStatus === 'confirmed') {
    return <Badge variant="secondary">Confirmed</Badge>;
  }
  if (props.row.bookingStatus === 'cancelled') {
    return <Badge variant="outline">Cancelled</Badge>;
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

function SessionActions(props: {
  readonly row: VisitorQuizSessionSummary;
  readonly deletingId: string | null;
  readonly onRequestDelete: (row: VisitorQuizSessionSummary) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {props.row.isBooked ? (
        <>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>View</Link>
          </Button>
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link href={buildBookManageHref(props.row.bookingId)}>Manage</Link>
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" asChild>
          <Link href={buildMarketingQuizSessionPath(props.row.marketingSessionRef)}>Continue</Link>
        </Button>
      )}
      {!props.row.isBooked ? (
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

type DeleteTarget = {
  readonly marketingSessionRef: string;
  readonly situationPreview: string | null;
};

/**
 * Signed-in user UI: API-paginated, searchable diagnostics list.
 */
export function AccountDiagnosticsPanel(): ReactElement {
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<readonly VisitorQuizSessionSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [hasAnySessions, setHasAnySessions] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [bookingReferenceInput, setBookingReferenceInput] = useState('');
  const [debouncedBookingReference, setDebouncedBookingReference] = useState('');
  const [statusFilter, setStatusFilter] = useState<VisitorQuizSessionListStatusFilter>('pending');
  const fetchRequestIdRef = useRef(0);
  const onNavigateError = useCallback((message: string): void => {
    setActionError(message);
  }, []);
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(true, onNavigateError);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedBookingReference(bookingReferenceInput.trim());
    }, BOOKING_REFERENCE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [bookingReferenceInput]);
  useEffect(() => {
    setPage(1);
  }, [debouncedBookingReference, statusFilter]);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const fetchSessions = useCallback(async (): Promise<void> => {
    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;
    setIsLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
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
      setSessions(data.sessions);
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
      }
    }
  }, [page, statusFilter, debouncedBookingReference]);
  useEffect(() => {
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
    [fetchSessions],
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
      situationPreview: row.situationPreview,
    });
  }, []);
  const tableData = useMemo(() => [...sessions], [sessions]);
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'bookingReference',
        header: 'Booking ref.',
        cell: (info) => <BookingReferenceCell row={info.row.original} />,
      }),
      columnHelper.accessor('updatedAtIso', {
        id: 'updatedAtIso',
        header: 'Last updated',
        cell: (info) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {DATE_TIME_FORMATTER.format(new Date(info.getValue()))}
          </span>
        ),
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
          if (row.bookingStartsAtIso === null || row.bookingTimezone === null) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          const slotFormatter = new Intl.DateTimeFormat('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: row.bookingTimezone,
          });
          const title =
            row.bookingServiceKey === 'project-rescue'
              ? PROJECT_RESCUE_SERVICE_TITLE
              : row.bookingServiceKey ?? 'Consultation';
          return (
            <div className="flex max-w-[18rem] flex-col gap-2">
              <span className="text-xs text-muted-foreground">{slotFormatter.format(new Date(row.bookingStartsAtIso))}</span>
              {row.bookingStatus === 'confirmed' ? (
                <AddToCalendarButtons
                  startsAtIso={row.bookingStartsAtIso}
                  title={title}
                  description={
                    row.bookingReferenceId !== null
                      ? `Booking reference ${row.bookingReferenceId}. Account diagnostics.`
                      : 'Account diagnostics.'
                  }
                  location={row.bookingMeetingUrl ?? undefined}
                  icsUidSeed={row.bookingReferenceId ?? row.bookingStartsAtIso}
                />
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor('situationPreview', {
        id: 'situationPreview',
        header: 'Summary',
        cell: (info) => {
          const row = info.row.original;
          if (row.situationPreview !== null && row.situationPreview.length > 0) {
            return (
              <span className="line-clamp-2 text-muted-foreground" title={row.situationPreview}>
                {row.situationPreview}
              </span>
            );
          }
          if (row.hasGuidedDiagnostic) {
            return <span className="text-sm text-muted-foreground">Guided diagnostic</span>;
          }
          return <span className="text-muted-foreground">—</span>;
        },
      }),
      columnHelper.accessor('currentStep', {
        id: 'currentStep',
        header: 'Step',
        cell: (info) => <span className="tabular-nums text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: (info) => (
          <SessionActions row={info.row.original} deletingId={deletingId} onRequestDelete={handleRequestDelete} />
        ),
      }),
    ],
    [deletingId, handleRequestDelete],
  );
  // TanStack Table returns unstable function references; React Compiler intentionally skips memoizing here.
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is documented as incompatible with compiler memoization
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * PAGE_SIZE, totalCount);
  const handleStatusFilterChange = (value: string): void => {
    setStatusFilter(value as VisitorQuizSessionListStatusFilter);
  };
  const handleBookingReferenceInputChange = (value: string): void => {
    setBookingReferenceInput(value);
  };
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
              deleteTarget.situationPreview !== null &&
              deleteTarget.situationPreview.length > 0 ? (
                <span className="mt-2 block rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
                  {deleteTarget.situationPreview}
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
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/80 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">Your diagnostic sessions</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-relaxed">
                Continue in-progress work, review booked sessions as read-only, or start a new diagnostic. Search by
                booking reference; booked sessions cannot be deleted from this list.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => {
                setActionError(null);
                void navigateToNewQuiz();
              }}
              disabled={isNavigating}
              className="w-full shrink-0 sm:w-auto"
            >
              <Plus className="size-4" aria-hidden />
              {isNavigating ? 'Starting…' : 'New diagnostic'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {actionError !== null ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}
          {loadError !== null ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : null}
          {!isLoading && !hasAnySessions ? (
            <DiagnosticsEmptyState
              isNavigating={isNavigating}
              onStart={() => {
                setActionError(null);
                void navigateToNewQuiz();
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
                <BookingReferenceFilterField value={bookingReferenceInput} onChange={handleBookingReferenceInputChange} />
                <StatusFilterField value={statusFilter} onChange={handleStatusFilterChange} disabled={isLoading} />
              </div>
              <p className="text-sm text-muted-foreground">
                {isLoading ? (
                  'Loading sessions…'
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
              <div className="overflow-hidden rounded-xl border border-border bg-card">
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
                      {isLoading ? (
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
        Status
      </Label>
      <NativeSelect
        id="diagnostic-status-filter"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10"
        disabled={props.disabled}
        aria-label="Filter diagnostics by status"
      >
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
        <option value="completed">Completed</option>
        <option value="all">All</option>
      </NativeSelect>
    </div>
  );
}

function DiagnosticsEmptyState(props: { readonly isNavigating: boolean; readonly onStart: () => void }): ReactElement {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
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
