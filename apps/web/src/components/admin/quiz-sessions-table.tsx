'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { DataTable } from '@/components/admin/data-table';
import type { QuizSessionListRow } from '@/lib/data/quiz-sessions';

type QuizSessionsTableProps = {
  readonly initialData: QuizSessionListRow[];
};

const columnHelper = createColumnHelper<QuizSessionListRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

export function QuizSessionsTable(props: QuizSessionsTableProps): ReactElement {
  const columns = useMemo(
    () => [
      columnHelper.accessor('updatedAtIso', {
        header: 'Updated (PH)',
        cell: (info) => DATE_TIME_FORMATTER.format(new Date(info.getValue())),
      }),
      columnHelper.accessor('visitorId', {
        header: 'Visitor',
        cell: (info) => {
          const value = info.getValue();
          const match = /^acct:([a-f\d]{24})$/i.exec(value);
          if (match !== null && match[1] !== undefined) {
            return (
              <Link
                href={`/admin/users/${match[1]}`}
                className="font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {value}
              </Link>
            );
          }
          return <span className="font-mono text-xs">{value}</span>;
        },
      }),
      columnHelper.accessor('currentStep', { header: 'Step' }),
      columnHelper.accessor('completedAtIso', {
        header: 'Completed',
        cell: (info) => {
          const value = info.getValue();
          return value !== null ? DATE_TIME_FORMATTER.format(new Date(value)) : '—';
        },
      }),
      columnHelper.accessor('isBooked', {
        header: 'Booked',
        cell: (info) => {
          const row = info.row.original;
          if (!row.isBooked || row.bookingId === null) {
            return '—';
          }
          return (
            <Link
              href={`/admin/bookings/${row.bookingId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Yes
            </Link>
          );
        },
      }),
      columnHelper.accessor('situationPreview', {
        header: 'Situation',
        cell: (info) => {
          const value = info.getValue();
          return value !== null && value.length > 0 ? (
            <span className="line-clamp-2 text-muted-foreground" title={value}>
              {value}
            </span>
          ) : (
            '—'
          );
        },
      }),
      columnHelper.display({
        id: 'details',
        header: 'Details',
        cell: (info) => (
          <Link
            href={`/admin/sessions/${info.row.original.id}`}
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
    <DataTable
      columns={columns}
      data={props.initialData.slice()}
      emptyMessage="No sessions in MongoDB yet (or MONGODB_URI is unset)."
    />
  );
}
