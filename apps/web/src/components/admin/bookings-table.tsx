'use client';

import { createColumnHelper } from '@tanstack/react-table';
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
      columnHelper.accessor('meetingUrl', {
        header: 'Meeting',
        cell: (info) => info.getValue() ?? '—',
      }),
    ],
    [],
  );
  return <DataTable columns={columns} data={initialData} emptyMessage="No bookings yet." />;
}
