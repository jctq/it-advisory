import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type {
  PaymentLogAdminPage,
  PaymentLogListGatewayFilter,
  PaymentLogListOutcomeFilter,
} from '@/lib/data/payment-logs';

export const ADMIN_PAYMENT_LOGS_QUERY_KEY = 'admin-payment-logs' as const;

const ADMIN_PAYMENT_LOGS_API_URL = buildApiUrl('/api/admin/payment-logs');

export type AdminPaymentLogsQueryFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly outcome: PaymentLogListOutcomeFilter;
  readonly gatewayId: PaymentLogListGatewayFilter;
};

async function fetchAdminPaymentLogs(filters: AdminPaymentLogsQueryFilters): Promise<PaymentLogAdminPage> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    outcome: filters.outcome,
    gatewayId: filters.gatewayId,
  });
  if (filters.search.length > 0) {
    params.set('q', filters.search);
  }
  const response = await fetch(`${ADMIN_PAYMENT_LOGS_API_URL}?${params.toString()}`, { cache: 'no-store' });
  const payload = (await response.json()) as PaymentLogAdminPage & { readonly error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load payment logs.');
  }
  return payload;
}

export function useAdminPaymentLogsQuery(
  filters: AdminPaymentLogsQueryFilters,
  enabled: boolean,
): UseQueryResult<PaymentLogAdminPage, Error> {
  return useQuery({
    queryKey: [ADMIN_PAYMENT_LOGS_QUERY_KEY, filters],
    queryFn: () => fetchAdminPaymentLogs(filters),
    enabled,
  });
}
