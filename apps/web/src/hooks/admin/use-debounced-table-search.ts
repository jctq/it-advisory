import { useEffect, useState } from 'react';
import { ADMIN_DEBUG_SEARCH_DEBOUNCE_MS } from '@/lib/admin/admin-paginated-list';

type UseDebouncedTableSearchResult = {
  readonly searchInput: string;
  readonly setSearchInput: (value: string) => void;
  readonly debouncedSearch: string;
  readonly hasActiveSearch: boolean;
};

export function useDebouncedTableSearch(): UseDebouncedTableSearchResult {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, ADMIN_DEBUG_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);
  const hasActiveSearch = debouncedSearch.length > 0;
  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    hasActiveSearch,
  };
}
