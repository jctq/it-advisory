'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DataTable } from '@/components/admin/data-table';
import type { LeadRow } from '@/lib/data/leads';

type LeadsTableProps = {
  initialData: LeadRow[];
};

const columnHelper = createColumnHelper<LeadRow>();

export function LeadsTable({ initialData }: LeadsTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('email', { header: 'Email' }),
      columnHelper.accessor('company', { header: 'Company' }),
      columnHelper.accessor('phone', { header: 'Phone' }),
      columnHelper.accessor('source', { header: 'Source' }),
      columnHelper.accessor('createdAtIso', {
        header: 'Created',
        cell: (info) => new Date(info.getValue()).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      }),
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      data={initialData}
      emptyMessage="No leads yet."
    />
  );
}
