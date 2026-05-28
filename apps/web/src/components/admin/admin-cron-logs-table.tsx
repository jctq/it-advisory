'use client';

import { createColumnHelper, type PaginationState } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { CRON_JOB_IDS, CRON_RUN_STATUSES, type CronJobId, type CronRunStatus } from '@/domain/cron-types';
import { useAdminCronLogsQuery } from '@/hooks/admin/use-admin-cron-logs-query';
import {
  ADMIN_DEBUG_SEARCH_DEBOUNCE_MS,
  ADMIN_DEBUG_TABLE_PAGE_SIZE,
} from '@/lib/admin/admin-paginated-list';
import type { CronJobRunAdminRow, CronJobRunListJobFilter, CronJobRunListStatusFilter } from '@/lib/data/cron-job-runs';

type AdminCronLogsTableProps = {
  readonly isActive: boolean;
};

const columnHelper = createColumnHelper<CronJobRunAdminRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function resolveStatusBadgeVariant(status: CronRunStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'success') {
    return 'default';
  }
  if (status === 'running') {
    return 'secondary';
  }
  if (status === 'error' || status === 'unauthorized') {
    return 'destructive';
  }
  return 'outline';
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return '—';
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatResultSummary(row: CronJobRunAdminRow): string {
  if (row.errorMessage !== null && row.errorMessage.length > 0) {
    return row.errorMessage;
  }
  if (row.result === null) {
    return '—';
  }
  const entries = Object.entries(row.result);
  if (entries.length === 0) {
    return '—';
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
}

function formatTriggerSource(source: CronJobRunAdminRow['triggerSource']): string {
  if (source === 'scheduled') {
    return 'Scheduled';
  }
  if (source === 'manual') {
    return 'Manual';
  }
  return 'Unknown';
}

function formatJobLabel(jobId: CronJobId): string {
  if (jobId === 'payment-holds') {
    return 'Payment holds';
  }
  return jobId;
}

export function AdminCronLogsTable(props: AdminCronLogsTableProps): ReactElement {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CronJobRunListStatusFilter>('all');
  const [jobFilter, setJobFilter] = useState<CronJobRunListJobFilter>('all');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: ADMIN_DEBUG_TABLE_PAGE_SIZE,
  });
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, ADMIN_DEBUG_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);
  useEffect(() => {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }, [debouncedSearch, statusFilter, jobFilter]);
  const queryFilters = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: debouncedSearch,
      status: statusFilter,
      jobId: jobFilter,
    }),
    [debouncedSearch, jobFilter, pagination.pageIndex, pagination.pageSize, statusFilter],
  );
  const query = useAdminCronLogsQuery(queryFilters, props.isActive);
  const rows = query.data?.rows ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && pagination.pageIndex >= totalPages) {
      setPagination((previous) => ({ ...previous, pageIndex: totalPages - 1 }));
    }
  }, [pagination.pageIndex, totalPages]);
  const columns = useMemo(
    () => [
      columnHelper.accessor('startedAtIso', {
        header: 'Started (PH)',
        cell: (info) => DATE_TIME_FORMATTER.format(new Date(info.getValue())),
      }),
      columnHelper.accessor('jobLabel', {
        header: 'Job',
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="font-medium text-foreground" title={row.jobId}>
              {info.getValue()}
            </span>
          );
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
      columnHelper.accessor('triggerSource', {
        header: 'Trigger',
        cell: (info) => formatTriggerSource(info.getValue()),
      }),
      columnHelper.accessor('durationMs', {
        header: 'Duration',
        cell: (info) => <span className="font-mono text-xs tabular-nums">{formatDuration(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'details',
        header: 'Details',
        cell: (info) => {
          const summary = formatResultSummary(info.row.original);
          return (
            <span className="line-clamp-2 text-xs text-muted-foreground" title={summary}>
              {summary}
            </span>
          );
        },
      }),
    ],
    [],
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <div className="space-y-2">
          <Label htmlFor="admin-cron-logs-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="admin-cron-logs-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Job id or error message"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-cron-logs-status">Status</Label>
          <NativeSelect
            id="admin-cron-logs-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CronJobRunListStatusFilter)}
          >
            <option value="all">All statuses</option>
            {CRON_RUN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-cron-logs-job">Job</Label>
          <NativeSelect
            id="admin-cron-logs-job"
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value as CronJobRunListJobFilter)}
          >
            <option value="all">All jobs</option>
            {CRON_JOB_IDS.map((jobId) => (
              <option key={jobId} value={jobId}>
                {formatJobLabel(jobId)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {query.error !== null ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={[...rows]}
        emptyMessage="No cron runs matched your filters."
        manualPagination
        pageCount={Math.max(1, totalPages)}
        totalCount={totalCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={query.isLoading}
      />
    </div>
  );
}
