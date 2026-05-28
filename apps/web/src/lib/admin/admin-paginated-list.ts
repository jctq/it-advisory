export type AdminPaginatedList<T> = {
  readonly rows: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

export const ADMIN_DEBUG_TABLE_PAGE_SIZE = 10 as const;

export const ADMIN_DEBUG_SEARCH_DEBOUNCE_MS = 300 as const;
