import type {
  PaginatedVisitorQuizSessionsResult,
  VisitorQuizSessionListStatusFilter,
} from '@/lib/data/quiz-sessions';

export const ACCOUNT_DIAGNOSTICS_PAGE_SIZE = 8;
export const ACCOUNT_DIAGNOSTICS_MOBILE_PAGE_SIZE = 15;
export const ACCOUNT_DIAGNOSTICS_DEFAULT_STATUS: VisitorQuizSessionListStatusFilter = 'pending';

export type AccountDiagnosticsListRequest = {
  readonly page: number;
  readonly pageSize: number;
  readonly status: VisitorQuizSessionListStatusFilter;
  readonly bookingReference: string;
};

export type AccountDiagnosticsInitialList = AccountDiagnosticsListRequest & {
  readonly result: PaginatedVisitorQuizSessionsResult;
};

export function matchesAccountDiagnosticsListRequest(
  left: AccountDiagnosticsListRequest,
  right: AccountDiagnosticsListRequest,
): boolean {
  return (
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.status === right.status &&
    left.bookingReference === right.bookingReference
  );
}

export function buildDefaultAccountDiagnosticsListRequest(): AccountDiagnosticsListRequest {
  return {
    page: 1,
    pageSize: ACCOUNT_DIAGNOSTICS_PAGE_SIZE,
    status: ACCOUNT_DIAGNOSTICS_DEFAULT_STATUS,
    bookingReference: '',
  };
}
