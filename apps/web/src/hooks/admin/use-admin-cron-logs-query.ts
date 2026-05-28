import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type {
  CronJobRunAdminPage,
  CronJobRunListJobFilter,
  CronJobRunListStatusFilter,
} from '@/lib/data/cron-job-runs';

export const ADMIN_CRON_LOGS_QUERY_KEY = 'admin-cron-logs' as const;

const ADMIN_CRON_LOGS_API_URL = buildApiUrl('/api/admin/cron-logs');

export type AdminCronLogsQueryFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly status: CronJobRunListStatusFilter;
  readonly jobId: CronJobRunListJobFilter;
};

async function fetchAdminCronLogs(filters: AdminCronLogsQueryFilters): Promise<CronJobRunAdminPage> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    status: filters.status,
    jobId: filters.jobId,
  });
  if (filters.search.length > 0) {
    params.set('q', filters.search);
  }
  const response = await fetch(`${ADMIN_CRON_LOGS_API_URL}?${params.toString()}`, { cache: 'no-store' });
  const payload = (await response.json()) as CronJobRunAdminPage & { readonly error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load cron logs.');
  }
  return payload;
}

export function useAdminCronLogsQuery(
  filters: AdminCronLogsQueryFilters,
  enabled: boolean,
): UseQueryResult<CronJobRunAdminPage, Error> {
  return useQuery({
    queryKey: [ADMIN_CRON_LOGS_QUERY_KEY, filters],
    queryFn: () => fetchAdminCronLogs(filters),
    enabled,
  });
}
