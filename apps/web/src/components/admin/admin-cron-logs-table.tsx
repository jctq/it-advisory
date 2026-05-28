'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { useMemo, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import type { CronJobRunAdminRow } from '@/lib/data/cron-job-runs';
import type { CronRunStatus } from '@/domain/cron-types';

type AdminCronLogsTableProps = {
  readonly initialData: readonly CronJobRunAdminRow[];
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

export function AdminCronLogsTable(props: AdminCronLogsTableProps): ReactElement {
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
    <DataTable
      columns={columns}
      data={[...props.initialData]}
      emptyMessage="No cron runs logged yet. Runs appear here after POST /api/cron/payment-holds fires."
    />
  );
}
