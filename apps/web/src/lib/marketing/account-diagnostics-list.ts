import type { PaginatedVisitorQuizSessionsResult } from '@/lib/data/quiz-session-types';
import type { BookingListStatusFilter } from '@/lib/marketing/account-booking-status';

export const ACCOUNT_DIAGNOSTICS_PAGE_SIZE = 8;
export const ACCOUNT_DIAGNOSTICS_MOBILE_PAGE_SIZE = 15;
export const ACCOUNT_DIAGNOSTICS_DEFAULT_STATUS: BookingListStatusFilter = 'pending';

export type AccountDiagnosticsListRequest = {
  readonly page: number;
  readonly pageSize: number;
  readonly status: BookingListStatusFilter;
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
