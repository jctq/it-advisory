'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import type { MarketingUserListRow } from '@/lib/data/marketing-users-admin';

type MarketingUsersTableProps = {
  readonly initialData: MarketingUserListRow[];
};

const columnHelper = createColumnHelper<MarketingUserListRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

export function MarketingUsersTable(props: MarketingUsersTableProps): ReactElement {
  const columns = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('createdAtIso', {
        header: 'Registered (PH)',
        cell: (info) => DATE_TIME_FORMATTER.format(new Date(info.getValue())),
      }),
      columnHelper.accessor('updatedAtIso', {
        header: 'Updated (PH)',
        cell: (info) => DATE_TIME_FORMATTER.format(new Date(info.getValue())),
      }),
      columnHelper.display({
        id: 'details',
        header: 'Details',
        cell: (info) => (
          <Link
            href={`/admin/users/${info.row.original.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            View
          </Link>
        ),
      }),
    ],
    [],
  );
  return (
    <div data-admin-tour="page-users-table">
      <DataTable
        columns={columns}
        data={props.initialData.slice()}
        emptyMessage="No marketing accounts yet (or MONGODB_URI is unset)."
      />
    </div>
  );
}
