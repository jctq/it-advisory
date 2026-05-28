'use client';

import Link from 'next/link';
import { ChevronRight, ImageIcon, Loader2, Search } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { SupportReportUserListRow } from '@/lib/data/support-reports';
import type { SupportReportListStatusFilter } from '@/lib/marketing/account-reports-list';
import { cn } from '@/lib/utils';

const MOBILE_STICKY_TOOLBAR_TOP_CLASS = 'top-14';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

const STATUS_TAB_OPTIONS: readonly { readonly id: SupportReportListStatusFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting_reply', label: 'Awaiting reply' },
  { id: 'has_reply', label: 'Has reply' },
] as const;

type AccountReportsMobileProps = {
  readonly reports: readonly SupportReportUserListRow[];
  readonly statusFilter: SupportReportListStatusFilter;
  readonly searchInput: string;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly hasMore: boolean;
  readonly totalCount: number;
  readonly onStatusFilterChange: (value: SupportReportListStatusFilter) => void;
  readonly onSearchInputChange: (value: string) => void;
  readonly onLoadMore: () => void;
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

function ReportListSkeleton(): ReactElement {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Mobile layout for account support reports: sticky search, status chips, and tappable rows.
 */
export function AccountReportsMobile(props: AccountReportsMobileProps): ReactElement {
  const {
    reports,
    statusFilter,
    searchInput,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    onStatusFilterChange,
    onSearchInputChange,
    onLoadMore,
  } = props;
  const [loadMoreSentinel, setLoadMoreSentinel] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (loadMoreSentinel === null || !hasMore || isLoading || isLoadingMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(loadMoreSentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMoreSentinel, onLoadMore]);
  return (
    <div className="md:hidden">
      <div
        className={cn(
          'sticky z-40 space-y-3 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80',
          MOBILE_STICKY_TOOLBAR_TOP_CLASS,
        )}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">My reports</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="account-reports-search-mobile"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search message, page, or report ID"
            className="h-10 pl-9"
            aria-label="Search support reports"
          />
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter reports by reply status"
        >
          {STATUS_TAB_OPTIONS.map((option) => {
            const isActive = statusFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={isLoading && reports.length === 0}
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
            Loading reports…
          </span>
        ) : totalCount === 0 ? (
          'No reports match your filters'
        ) : (
          <>
            <span className="font-medium text-foreground">{totalCount}</span> report
            {totalCount === 1 ? '' : 's'}
          </>
        )}
      </p>
      {isLoading && reports.length === 0 ? (
        <ReportListSkeleton />
      ) : (
        <ul className="space-y-3 px-4 pb-6 pt-2">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/account/reports/${encodeURIComponent(report.id)}`}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:bg-accent/30"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{report.messagePreview}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{report.route}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{report.source}</Badge>
                    <ReportStatusBadge
                      hasStaffReply={report.hasStaffReply}
                      hasUnreadStaffReply={report.hasUnreadStaffReply}
                    />
                    {report.hasScreenshot ? (
                      <Badge variant="outline" className="gap-1">
                        <ImageIcon className="size-3" aria-hidden />
                        Screenshot
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {DATE_TIME_FORMATTER.format(new Date(report.createdAtIso))}
                    {report.replyCount > 0
                      ? ` · ${report.replyCount} message${report.replyCount === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hasMore ? (
        <div ref={setLoadMoreSentinel} className="flex justify-center px-4 pb-8 pt-2">
          {isLoadingMore ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
              Loading more…
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Scroll for more</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
