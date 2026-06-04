'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { AdminTableKeywordSearch, type AdminTableKeywordSearchOption } from '@/components/admin/admin-table-keyword-search';
import { DataTable } from '@/components/admin/data-table';
import { useDebouncedTableSearch } from '@/hooks/admin/use-debounced-table-search';
import { valueContainsTableKeyword } from '@/lib/admin/matches-table-keyword-search';
import type { MarketingUserListRow } from '@/lib/data/marketing-users-admin';

type MarketingUsersTableProps = {
  readonly initialData: MarketingUserListRow[];
};

type MarketingUserSearchField = 'email' | 'userId';

const MARKETING_USER_SEARCH_OPTIONS: readonly AdminTableKeywordSearchOption<MarketingUserSearchField>[] = [
  { id: 'email', label: 'Email', placeholder: 'Email address…' },
  { id: 'userId', label: 'User id', placeholder: 'Mongo user id…' },
];

const columnHelper = createColumnHelper<MarketingUserListRow>();

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function marketingUserRowMatchesSearch(
  row: MarketingUserListRow,
  searchField: MarketingUserSearchField,
  searchQuery: string,
): boolean {
  const needle = searchQuery.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  if (searchField === 'email') {
    return valueContainsTableKeyword(row.email, needle);
  }
  return valueContainsTableKeyword(row.id, needle);
}

export function MarketingUsersTable(props: MarketingUsersTableProps): ReactElement {
  const { searchInput, setSearchInput, debouncedSearch, hasActiveSearch } = useDebouncedTableSearch();
  const [searchField, setSearchField] = useState<MarketingUserSearchField>('email');
  const filteredData = useMemo(() => {
    if (!hasActiveSearch) {
      return props.initialData.slice();
    }
    return props.initialData.filter((row) => marketingUserRowMatchesSearch(row, searchField, debouncedSearch));
  }, [debouncedSearch, hasActiveSearch, props.initialData, searchField]);
  const tableKey = hasActiveSearch ? `${searchField}:${debouncedSearch}` : 'all';
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
    <div data-admin-tour="page-users-table" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filteredData.length.toLocaleString()}</span>{' '}
          {filteredData.length === 1 ? 'user' : 'users'}
        </p>
        <AdminTableKeywordSearch
          id="admin-marketing-users-search"
          options={MARKETING_USER_SEARCH_OPTIONS}
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
          hasActiveSearch
            ? 'No marketing accounts matched your search.'
            : 'No marketing accounts yet (or MONGODB_URI is unset).'
        }
      />
    </div>
  );
}
