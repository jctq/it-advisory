'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo } from 'react';
import { DataTable } from '@/components/admin/data-table';
import type { BookingRow } from '@/lib/data/bookings';

type BookingsTableProps = {
  initialData: BookingRow[];
};

const columnHelper = createColumnHelper<BookingRow>();

export function BookingsTable({ initialData }: BookingsTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('serviceKey', { header: 'Service' }),
      columnHelper.accessor('startsAtIso', {
        header: 'Starts (PH)',
        cell: (info) =>
          new Date(info.getValue()).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      }),
      columnHelper.accessor('status', { header: 'Status' }),
      columnHelper.accessor('visitorId', { header: 'Visitor' }),
      columnHelper.accessor('quizSessionId', {
        header: 'Quiz session',
        cell: (info) => {
          const id = info.getValue();
          if (id === null || id.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Link
              href={`/admin/quiz-sessions/${id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              View
            </Link>
          );
        },
      }),
      columnHelper.display({
        id: 'details',
        header: 'Details',
        cell: (info) => (
          <Link
            href={`/admin/bookings/${info.row.original.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            View
          </Link>
        ),
      }),
      columnHelper.accessor('hasDiagnosticSnapshot', {
        header: 'Diagnostic',
        cell: (info) => (info.getValue() ? 'Yes' : '—'),
      }),
      columnHelper.accessor('meetingUrl', {
        header: 'Meeting',
        cell: (info) => info.getValue() ?? '—',
      }),
    ],
    [],
  );
  return <DataTable columns={columns} data={initialData} emptyMessage="No bookings yet." />;
}
