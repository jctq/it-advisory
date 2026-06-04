'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { AdminTableKeywordSearch, type AdminTableKeywordSearchOption } from '@/components/admin/admin-table-keyword-search';
import { DataTable } from '@/components/admin/data-table';
import { useDebouncedTableSearch } from '@/hooks/admin/use-debounced-table-search';
import { valueContainsTableKeyword } from '@/lib/admin/matches-table-keyword-search';
import type { DiagnosticSessionListRow } from '@/lib/data/diagnostic-session-types';
import {
  bookingIdMatchesReferenceInput,
  formatBookingReferenceId,
} from '@/lib/marketing/booking-reference';

type DiagnosticSessionsTableProps = {
  readonly initialData: DiagnosticSessionListRow[];
};

type SessionSearchField = 'visitor' | 'session' | 'step' | 'booked';

const SESSION_SEARCH_OPTIONS: readonly AdminTableKeywordSearchOption<SessionSearchField>[] = [
  { id: 'visitor', label: 'Visitor', placeholder: 'Visitor id…' },
  { id: 'session', label: 'Session', placeholder: 'Session title or summary…' },
  { id: 'step', label: 'Step', placeholder: 'Step number…' },
  { id: 'booked', label: 'Booked', placeholder: 'yes, no, or booking reference…' },
];

const columnHelper = createColumnHelper<DiagnosticSessionListRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function sessionRowMatchesSearch(
  row: DiagnosticSessionListRow,
  searchField: SessionSearchField,
  searchQuery: string,
): boolean {
  const needle = searchQuery.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  if (searchField === 'visitor') {
    return valueContainsTableKeyword(row.visitorId, needle);
  }
  if (searchField === 'session') {
    return (
      valueContainsTableKeyword(row.sessionTitlePreview, needle) ||
      valueContainsTableKeyword(row.situationPreview, needle) ||
      valueContainsTableKeyword(row.situationLabel, needle)
    );
  }
  if (searchField === 'step') {
    return valueContainsTableKeyword(String(row.currentStep), needle);
  }
  if (!row.isBooked || row.bookingId === null) {
    return 'no unbooked —'.includes(needle);
  }
  const bookingReference = formatBookingReferenceId(row.bookingId);
  return (
    valueContainsTableKeyword('yes', needle) ||
    valueContainsTableKeyword('booked', needle) ||
    valueContainsTableKeyword(row.bookingId, needle) ||
    valueContainsTableKeyword(bookingReference, needle) ||
    bookingIdMatchesReferenceInput(row.bookingId, searchQuery.trim())
  );
}

export function DiagnosticSessionsTable(props: DiagnosticSessionsTableProps): ReactElement {
  const { searchInput, setSearchInput, debouncedSearch, hasActiveSearch } = useDebouncedTableSearch();
  const [searchField, setSearchField] = useState<SessionSearchField>('visitor');
  const filteredData = useMemo(() => {
    if (!hasActiveSearch) {
      return props.initialData.slice();
    }
    return props.initialData.filter((row) => sessionRowMatchesSearch(row, searchField, debouncedSearch));
  }, [debouncedSearch, hasActiveSearch, props.initialData, searchField]);
  const tableKey = hasActiveSearch ? `${searchField}:${debouncedSearch}` : 'all';
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
      columnHelper.accessor('sessionTitlePreview', {
        header: 'Session',
        cell: (info) => {
          const row = info.row.original;
          const title = info.getValue();
          if (title !== null && title.length > 0) {
            return (
              <span className="line-clamp-2 font-medium text-foreground" title={title}>
                {title}
              </span>
            );
          }
          const summary = row.situationPreview;
          return summary !== null && summary.length > 0 ? (
            <span className="line-clamp-2 text-muted-foreground" title={summary}>
              {summary}
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
    <div data-admin-tour="page-sessions-table" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filteredData.length.toLocaleString()}</span>{' '}
          {filteredData.length === 1 ? 'session' : 'sessions'}
        </p>
        <AdminTableKeywordSearch
          id="admin-sessions-search"
          options={SESSION_SEARCH_OPTIONS}
          searchField={searchField}
          onSearchFieldChange={setSearchField}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
        />
      </div>
      <DataTable
        key={tableKey}
        columns={columns}
        data={filteredData}
        emptyMessage={
          hasActiveSearch ? 'No sessions matched your search.' : 'No sessions in MongoDB yet (or MONGODB_URI is unset).'
        }
      />
    </div>
  );
}
