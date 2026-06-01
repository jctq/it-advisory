import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { BookingRefundAdminPage, BookingRefundListStatusFilter } from '@/lib/data/booking-refunds';

export const ADMIN_REFUNDS_QUERY_KEY = 'admin-refunds' as const;

const ADMIN_REFUNDS_API_URL = buildApiUrl('/api/admin/refunds');

export type AdminRefundsQueryFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly status: BookingRefundListStatusFilter;
};

async function fetchAdminRefunds(filters: AdminRefundsQueryFilters): Promise<BookingRefundAdminPage> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    status: filters.status,
  });
  const response = await fetch(`${ADMIN_REFUNDS_API_URL}?${params.toString()}`, { cache: 'no-store' });
  const payload = (await response.json()) as BookingRefundAdminPage & { readonly error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load refunds.');
  }
  return payload;
}

export function useAdminRefundsQuery(
  filters: AdminRefundsQueryFilters,
): UseQueryResult<BookingRefundAdminPage, Error> {
  return useQuery({
    queryKey: [ADMIN_REFUNDS_QUERY_KEY, filters],
    queryFn: () => fetchAdminRefunds(filters),
  });
}
