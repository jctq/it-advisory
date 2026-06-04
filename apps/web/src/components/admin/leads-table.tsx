'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { useMemo, useState, type ReactElement } from 'react';
import { AdminTableKeywordSearch, type AdminTableKeywordSearchOption } from '@/components/admin/admin-table-keyword-search';
import { DataTable } from '@/components/admin/data-table';
import { useDebouncedTableSearch } from '@/hooks/admin/use-debounced-table-search';
import { valueContainsTableKeyword } from '@/lib/admin/matches-table-keyword-search';
import type { LeadRow } from '@/lib/data/leads';

type LeadsTableProps = {
  readonly initialData: readonly LeadRow[];
};

type LeadSearchField = 'name' | 'email' | 'company' | 'phone' | 'source';

const LEAD_SEARCH_OPTIONS: readonly AdminTableKeywordSearchOption<LeadSearchField>[] = [
  { id: 'name', label: 'Name', placeholder: 'Contact name…' },
  { id: 'email', label: 'Email', placeholder: 'Email address…' },
  { id: 'company', label: 'Company', placeholder: 'Company…' },
  { id: 'phone', label: 'Phone', placeholder: 'Phone number…' },
  { id: 'source', label: 'Source', placeholder: 'Lead source…' },
];

const columnHelper = createColumnHelper<LeadRow>();

function leadRowMatchesSearch(row: LeadRow, searchField: LeadSearchField, searchQuery: string): boolean {
  const needle = searchQuery.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  if (searchField === 'name') {
    return valueContainsTableKeyword(row.name, needle);
  }
  if (searchField === 'email') {
    return valueContainsTableKeyword(row.email, needle);
  }
  if (searchField === 'company') {
    return valueContainsTableKeyword(row.company, needle);
  }
  if (searchField === 'phone') {
    return valueContainsTableKeyword(row.phone, needle);
  }
  return valueContainsTableKeyword(row.source, needle);
}

export function LeadsTable({ initialData }: LeadsTableProps): ReactElement {
  const { searchInput, setSearchInput, debouncedSearch, hasActiveSearch } = useDebouncedTableSearch();
  const [searchField, setSearchField] = useState<LeadSearchField>('name');
  const filteredData = useMemo(() => {
    if (!hasActiveSearch) {
      return [...initialData];
    }
    return initialData.filter((row) => leadRowMatchesSearch(row, searchField, debouncedSearch));
  }, [debouncedSearch, hasActiveSearch, initialData, searchField]);
  const tableKey = hasActiveSearch ? `${searchField}:${debouncedSearch}` : 'all';
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
    <div data-admin-tour="page-leads-table" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filteredData.length.toLocaleString()}</span>{' '}
          {filteredData.length === 1 ? 'lead' : 'leads'}
        </p>
        <AdminTableKeywordSearch
          id="admin-leads-search"
          options={LEAD_SEARCH_OPTIONS}
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
        emptyMessage={hasActiveSearch ? 'No leads matched your search.' : 'No leads yet.'}
      />
    </div>
  );
}
