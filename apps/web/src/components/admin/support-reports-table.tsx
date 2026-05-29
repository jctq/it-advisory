'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import type { SupportReportAdminListRow } from '@/lib/data/support-reports';

type SupportReportsTableProps = {
  readonly initialData: readonly SupportReportAdminListRow[];
};

const columnHelper = createColumnHelper<SupportReportAdminListRow>();

export function SupportReportsTable(props: SupportReportsTableProps): ReactElement {
  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAtIso', {
        header: 'Submitted',
        cell: (info) =>
          new Date(info.getValue()).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }),
      }),
      columnHelper.accessor('source', {
        header: 'Source',
        cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
      }),
      columnHelper.accessor('route', {
        header: 'Route',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('reporterEmail', {
        header: 'Reporter',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('messagePreview', {
        header: 'Message',
        cell: (info) => <span className="line-clamp-2 text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor('replyCount', {
        header: 'Replies',
        cell: (info) => info.getValue(),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <Link className="text-sm font-medium text-primary hover:underline" href={`/admin/support-reports/${info.row.original.id}`}>
            Open
          </Link>
        ),
      }),
    ],
    [],
  );
  return (
    <div data-admin-tour="page-support-reports-table">
    <DataTable
      columns={columns}
      data={[...props.initialData]}
      emptyMessage="No support reports yet."
    />
    </div>
  );
}
