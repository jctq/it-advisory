'use client';

import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import type { QuizAuditAdminRow } from '@/lib/data/quiz-session-types';

type QuizSessionAuditTableProps = {
  readonly rows: readonly QuizAuditAdminRow[];
};

const AUDIT_PAGE_SIZE = 8;
const PREVIEW_MAX_CHARS = 96;
const columnHelper = createColumnHelper<QuizAuditAdminRow>();

const SAVED_AT_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function formatSavedAt(iso: string): string {
  return SAVED_AT_FORMATTER.format(new Date(iso));
}

function truncatePreview(json: string): string {
  const singleLine = json.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= PREVIEW_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, PREVIEW_MAX_CHARS)}…`;
}

export function QuizSessionAuditTable(props: QuizSessionAuditTableProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const data = useMemo(() => props.rows.slice(), [props.rows]);
  const selectedRow = useMemo(() => data.find((row) => row.id === selectedId) ?? null, [data, selectedId]);
  const columns = useMemo(
    () => [
      columnHelper.accessor('step', {
        header: 'Step',
        cell: (info) => <span className="font-mono tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor('createdAtIso', {
        header: 'Saved at',
        cell: (info) => <span className="whitespace-nowrap">{formatSavedAt(info.getValue())}</span>,
      }),
      columnHelper.accessor('answersJson', {
        id: 'preview',
        header: 'Preview',
        cell: (info) => (
          <span className="line-clamp-2 font-mono text-xs text-muted-foreground" title={truncatePreview(info.getValue())}>
            {truncatePreview(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'view',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          const isSelected = selectedId === row.id;
          return (
            <Button
              type="button"
              variant={isSelected ? 'secondary' : 'ghost'}
              size="sm"
              className="shrink-0"
              onClick={() => {
                setSelectedId(isSelected ? null : row.id);
              }}
            >
              {isSelected ? 'Hide' : 'View'}
            </Button>
          );
        },
      }),
    ],
    [selectedId],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable refs; intentional here.
  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: AUDIT_PAGE_SIZE } },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No save history rows for this session.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b border-border bg-muted/40 [&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors hover:bg-muted/40">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="max-w-[min(28rem,45vw)] p-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {data.length} total
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.previousPage();
              setSelectedId(null);
            }}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.nextPage();
              setSelectedId(null);
            }}
          >
            Next
          </Button>
        </div>
      </div>
      {selectedRow !== null ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Payload · step {selectedRow.step} · {formatSavedAt(selectedRow.createdAtIso)}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </div>
          <pre className="mt-3 max-h-[min(70vh,32rem)] overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed">
            {selectedRow.answersJson}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
