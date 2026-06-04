'use client';

import { Search } from 'lucide-react';
import type { ReactElement } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export type AdminTableKeywordSearchOption<TField extends string> = {
  readonly id: TField;
  readonly label: string;
  readonly placeholder: string;
};

type AdminTableKeywordSearchProps<TField extends string> = {
  readonly id: string;
  readonly options: readonly AdminTableKeywordSearchOption<TField>[];
  readonly searchField: TField;
  readonly onSearchFieldChange: (field: TField) => void;
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly className?: string;
};

export function AdminTableKeywordSearch<TField extends string>(
  props: AdminTableKeywordSearchProps<TField>,
): ReactElement {
  const placeholder =
    props.options.find((option) => option.id === props.searchField)?.placeholder ?? 'Search…';
  return (
    <div className={props.className ?? 'flex min-w-0 items-center gap-2 sm:max-w-md'}>
      <NativeSelect
        id={`${props.id}-field`}
        value={props.searchField}
        onChange={(event) => props.onSearchFieldChange(event.target.value as TField)}
        className="h-9 w-30 shrink-0"
        aria-label="Search field"
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={`${props.id}-query`}
          value={props.searchInput}
          onChange={(event) => props.onSearchInputChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 pl-9"
          aria-label={`Search by ${props.searchField}`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
