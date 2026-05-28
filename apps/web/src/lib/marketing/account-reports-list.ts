import type { SupportReportUserPage } from '@/lib/data/support-reports';

export const ACCOUNT_REPORTS_PAGE_SIZE = 8;
export const ACCOUNT_REPORTS_MOBILE_PAGE_SIZE = 15;
export const ACCOUNT_REPORTS_SEARCH_DEBOUNCE_MS = 300;

export type SupportReportListStatusFilter = 'all' | 'awaiting_reply' | 'has_reply';

export const ACCOUNT_REPORTS_DEFAULT_STATUS: SupportReportListStatusFilter = 'all';

export type AccountReportsListRequest = {
  readonly page: number;
  readonly pageSize: number;
  readonly status: SupportReportListStatusFilter;
  readonly search: string;
};

export type AccountReportsInitialList = AccountReportsListRequest & {
  readonly result: SupportReportUserPage;
};

export function normalizeSupportReportListStatusFilter(value: string): SupportReportListStatusFilter {
  if (value === 'awaiting_reply' || value === 'has_reply' || value === 'all') {
    return value;
  }
  return ACCOUNT_REPORTS_DEFAULT_STATUS;
}

export function matchesAccountReportsListRequest(
  left: AccountReportsListRequest,
  right: AccountReportsListRequest,
): boolean {
  return (
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.status === right.status &&
    left.search === right.search
  );
}

export function buildDefaultAccountReportsListRequest(): AccountReportsListRequest {
  return {
    page: 1,
    pageSize: ACCOUNT_REPORTS_PAGE_SIZE,
    status: ACCOUNT_REPORTS_DEFAULT_STATUS,
    search: '',
  };
}
