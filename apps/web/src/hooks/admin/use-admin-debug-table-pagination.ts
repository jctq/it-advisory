import { type OnChangeFn, type PaginationState } from '@tanstack/react-table';
import { useState } from 'react';
import { ADMIN_DEBUG_TABLE_PAGE_SIZE } from '@/lib/admin/admin-paginated-list';

export function useAdminDebugTablePagination(
  filterSignature: string,
): [PaginationState, OnChangeFn<PaginationState>] {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: ADMIN_DEBUG_TABLE_PAGE_SIZE,
  });
  const [storedFilterSignature, setStoredFilterSignature] = useState(filterSignature);
  if (storedFilterSignature !== filterSignature) {
    setStoredFilterSignature(filterSignature);
    if (pagination.pageIndex !== 0) {
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    }
  }
  return [pagination, setPagination];
}
