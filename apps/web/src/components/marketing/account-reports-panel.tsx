'use client';

import Link from 'next/link';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronRight, ImageIcon, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AccountReportsMobile } from '@/components/marketing/account-reports-mobile';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { SupportReportUserListRow, SupportReportUserPage } from '@/lib/data/support-reports';
import {
  ACCOUNT_REPORTS_MOBILE_PAGE_SIZE,
  ACCOUNT_REPORTS_PAGE_SIZE,
  ACCOUNT_REPORTS_SEARCH_DEBOUNCE_MS,
  buildDefaultAccountReportsListRequest,
  matchesAccountReportsListRequest,
  normalizeSupportReportListStatusFilter,
  type AccountReportsInitialList,
  type SupportReportListStatusFilter,
} from '@/lib/marketing/account-reports-list';
import { useMobileViewport } from '@/hooks/use-mobile-viewport';
import { cn } from '@/lib/utils';

const MY_REPORTS_API_URL = buildApiUrl('/api/support/my-reports');

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

const columnHelper = createColumnHelper<SupportReportUserListRow>();

/** Fixed widths for compact columns; message column has no width so it absorbs the remainder. */
const TABLE_COLUMN_WIDTHS: Readonly<Partial<Record<string, string>>> = {
  route: '10rem',
  source: '5.25rem',
  status: '7.5rem',
  submitted: '11rem',
  actions: '5.75rem',
};

const TABLE_CELL_CLASS_NAMES: Readonly<Partial<Record<string, string>>> = {
  route: 'max-w-0',
  source: 'whitespace-nowrap',
  status: 'whitespace-nowrap',
  submitted: 'whitespace-nowrap',
  actions: 'whitespace-nowrap text-right',
};

type AccountReportsPanelProps = {
  readonly initialList?: AccountReportsInitialList;
};

function ReportStatusBadge(props: {
  readonly hasStaffReply: boolean;
  readonly hasUnreadStaffReply: boolean;
}): ReactElement {
  if (props.hasUnreadStaffReply) {
    return <Badge className="bg-primary text-primary-foreground hover:bg-primary">New reply</Badge>;
  }
  if (props.hasStaffReply) {
    return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Has reply</Badge>;
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
      Awaiting reply
    </Badge>
  );
}

function ReportsTableSkeleton(props: { readonly columnCount: number }): ReactElement {
  return (
    <>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border/80 last:border-0">
          {Array.from({ length: props.columnCount }, (_, cellIndex) => (
            <td key={cellIndex} className="px-4 py-3.5">
              <Skeleton className="h-4 w-full max-w-[12rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function ReportsListLoadingOverlay(): ReactElement {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading reports</span>
    </div>
  );
}

function ReportsPagination(props: {
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

/**
 * Signed-in user UI: searchable, filterable support reports list.
 */
export function AccountReportsPanel(props: AccountReportsPanelProps): ReactElement {
  const defaultListRequest = buildDefaultAccountReportsListRequest();
  const hasServerInitialList =
    props.initialList !== undefined && matchesAccountReportsListRequest(props.initialList, defaultListRequest);
  const [reports, setReports] = useState<readonly SupportReportUserListRow[]>(
    hasServerInitialList && props.initialList !== undefined ? props.initialList.result.reports : [],
  );
  const [totalCount, setTotalCount] = useState(
    hasServerInitialList && props.initialList !== undefined ? props.initialList.result.totalCount : 0,
  );
  const [totalPages, setTotalPages] = useState(
    hasServerInitialList && props.initialList !== undefined ? props.initialList.result.totalPages : 0,
  );
  const [hasAnyReports, setHasAnyReports] = useState(
    hasServerInitialList && props.initialList !== undefined ? props.initialList.result.hasAnyReports : false,
  );
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupportReportListStatusFilter>(defaultListRequest.status);
  const [isLoading, setIsLoading] = useState(!hasServerInitialList);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isMobileViewport = useMobileViewport();
  const fetchRequestIdRef = useRef(0);
  const skipInitialFetchRef = useRef(hasServerInitialList);
  const pageSize = isMobileViewport ? ACCOUNT_REPORTS_MOBILE_PAGE_SIZE : ACCOUNT_REPORTS_PAGE_SIZE;
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, ACCOUNT_REPORTS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, isMobileViewport, statusFilter]);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const fetchReports = useCallback(async (): Promise<void> => {
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
    if (debouncedSearch.length > 0) {
      params.set('q', debouncedSearch);
    }
    try {
      const response = await fetch(`${MY_REPORTS_API_URL}?${params.toString()}`, { credentials: 'include' });
      const payload = (await response.json()) as SupportReportUserPage & { readonly error?: string };
      if (fetchRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load reports.');
      }
      setTotalCount(payload.totalCount);
      setTotalPages(payload.totalPages);
      setHasAnyReports(payload.hasAnyReports);
      setReports((previous) => (shouldAppend ? [...previous, ...payload.reports] : payload.reports));
    } catch (fetchError: unknown) {
      if (fetchRequestIdRef.current !== requestId) {
        return;
      }
      setLoadError(fetchError instanceof Error ? fetchError.message : 'Failed to load reports.');
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [debouncedSearch, isMobileViewport, page, pageSize, statusFilter]);
  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    void fetchReports();
  }, [fetchReports]);
  const columns = useMemo(
    () => [
      columnHelper.accessor('messagePreview', {
        id: 'message',
        header: 'Message',
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="line-clamp-2 font-medium text-foreground">{row.original.messagePreview}</p>
            {row.original.hasScreenshot ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <ImageIcon className="size-3" aria-hidden />
                Screenshot
              </span>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor('route', {
        id: 'route',
        header: 'Page',
        cell: ({ getValue }) => <span className="block truncate font-mono text-xs text-muted-foreground">{getValue()}</span>,
      }),
      columnHelper.accessor('source', {
        id: 'source',
        header: 'Platform',
        cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
      }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ReportStatusBadge
            hasStaffReply={row.original.hasStaffReply}
            hasUnreadStaffReply={row.original.hasUnreadStaffReply}
          />
        ),
      }),
      columnHelper.accessor('createdAtIso', {
        id: 'submitted',
        header: 'Submitted',
        cell: ({ getValue }) => (
          <time className="text-sm text-muted-foreground" dateTime={getValue()}>
            {DATE_TIME_FORMATTER.format(new Date(getValue()))}
          </time>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="sr-only">Open</span>,
        cell: ({ row }) => (
          <Link
            href={`/account/reports/${encodeURIComponent(row.original.id)}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex shrink-0 gap-1')}
          >
            Open
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ),
      }),
    ],
    [],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable refs; same pattern as account diagnostics panel.
  const table = useReactTable({
    data: reports as SupportReportUserListRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const hasMoreReports = isMobileViewport && page < totalPages;
  const handleStatusFilterChange = (value: SupportReportListStatusFilter): void => {
    setStatusFilter(value);
  };
  const handleLoadMoreReports = (): void => {
    if (!isMobileViewport || isLoading || isLoadingMore || !hasMoreReports) {
      return;
    }
    setPage((current) => current + 1);
  };
  return (
    <div className="space-y-6">
      <Card className="gap-0 border-0 bg-transparent py-0 shadow-none md:gap-6 md:border md:border-border/80 md:bg-card md:py-6 md:shadow-sm">
        <CardContent className="space-y-6 px-0 pt-0 md:px-6">
          {loadError !== null ? (
            <p className="mx-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive md:mx-0" role="alert">
              {loadError}
            </p>
          ) : null}
          {!isLoading && !hasAnyReports ? (
            <div className="mx-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center md:mx-0">
              <p className="text-sm font-medium text-foreground">No support reports yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the <strong className="font-medium text-foreground">Report</strong> button on any page to send feedback with a screenshot.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AccountReportsMobile
                reports={reports}
                statusFilter={statusFilter}
                searchInput={searchInput}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                hasMore={hasMoreReports}
                totalCount={totalCount}
                onStatusFilterChange={handleStatusFilterChange}
                onSearchInputChange={setSearchInput}
                onLoadMore={handleLoadMoreReports}
              />
              <div className="hidden space-y-4 md:block">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
                  <ReportsSearchField value={searchInput} onChange={setSearchInput} />
                  <ReportsStatusFilterField
                    value={statusFilter}
                    onChange={(value) => handleStatusFilterChange(normalizeSupportReportListStatusFilter(value))}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                      Loading reports…
                    </span>
                  ) : totalCount === 0 ? (
                    <>No reports match your filters</>
                  ) : (
                    <>
                      Showing <span className="font-medium text-foreground">{rangeStart}</span>–
                      <span className="font-medium text-foreground">{rangeEnd}</span> of{' '}
                      <span className="font-medium text-foreground">{totalCount}</span>
                    </>
                  )}
                </p>
                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                  {isLoading && reports.length > 0 ? <ReportsListLoadingOverlay /> : null}
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        {table.getAllLeafColumns().map((column) => {
                          const width = TABLE_COLUMN_WIDTHS[column.id];
                          return (
                            <col key={column.id} style={width !== undefined ? { width } : undefined} />
                          );
                        })}
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
                                  header.column.id !== 'message' && header.column.id !== 'actions' && 'whitespace-nowrap',
                                )}
                              >
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {isLoading && reports.length === 0 ? (
                          <ReportsTableSkeleton columnCount={columns.length} />
                        ) : table.getRowModel().rows.length === 0 ? (
                          <tr>
                            <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                              No reports on this page. Try another filter or search term.
                            </td>
                          </tr>
                        ) : (
                          table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                              {row.getVisibleCells().map((cell) => (
                                <td
                                  key={cell.id}
                                  className={cn(
                                    'px-4 py-3.5 align-middle',
                                    TABLE_CELL_CLASS_NAMES[cell.column.id],
                                  )}
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
                  <ReportsPagination
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

function ReportsSearchField(props: { readonly value: string; readonly onChange: (value: string) => void }): ReactElement {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="account-reports-search" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Search
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="account-reports-search"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Message, page, or report ID"
          className="h-10 pl-9"
        />
      </div>
    </div>
  );
}

function ReportsStatusFilterField(props: {
  readonly value: SupportReportListStatusFilter;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="account-reports-status-filter" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Reply status
      </Label>
      <NativeSelect
        id="account-reports-status-filter"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10"
        disabled={props.disabled}
        aria-label="Filter by reply status"
      >
        <option value="all">All</option>
        <option value="awaiting_reply">Awaiting reply</option>
        <option value="has_reply">Has reply</option>
      </NativeSelect>
    </div>
  );
}
