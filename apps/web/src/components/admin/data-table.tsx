'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
} from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

type DataTableProps<TData> = {
  /** Column value types differ per accessor; use `any` to satisfy TanStack Table + TypeScript. */
  columns: ColumnDef<TData, any>[];
  data: TData[];
  emptyMessage?: string;
  resolveRowClassName?: (row: TData) => string | undefined;
  manualPagination?: boolean;
  pageCount?: number;
  totalCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  isLoading?: boolean;
};

export function DataTable<TData>({
  columns,
  data,
  emptyMessage,
  resolveRowClassName,
  manualPagination = false,
  pageCount,
  totalCount,
  pagination: controlledPagination,
  onPaginationChange,
  isLoading = false,
}: DataTableProps<TData>) {
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const pagination = controlledPagination ?? internalPagination;
  const setPagination = onPaginationChange ?? setInternalPagination;
  const resolvedTotalCount = totalCount ?? data.length;
  const resolvedPageCount =
    manualPagination === true ? Math.max(1, pageCount ?? 1) : Math.max(1, Math.ceil(resolvedTotalCount / pagination.pageSize));
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable refs for pagination; intentional here.
  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination,
    pageCount: manualPagination ? resolvedPageCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });
  const showEmptyState = !isLoading && table.getRowModel().rows.length === 0;
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <span className="sr-only">Loading table rows</span>
          </div>
        ) : null}
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b border-border bg-muted/40 [&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border transition-colors">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {showEmptyState ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-6 text-center align-middle text-muted-foreground"
                >
                  {emptyMessage ?? 'No rows yet.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/40',
                    resolveRowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 px-1">
        <p className="text-sm text-muted-foreground">
          Page {pagination.pageIndex + 1} of {resolvedPageCount} · {resolvedTotalCount} total
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(!table.getCanPreviousPage() && 'pointer-events-none opacity-40')}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || isLoading}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(!table.getCanNextPage() && 'pointer-events-none opacity-40')}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
