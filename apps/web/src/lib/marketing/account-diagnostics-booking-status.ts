import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';
import {
  resolveAccountBookingStatusFromSummary,
  type AccountBookingStatus,
} from '@/lib/marketing/account-booking-status';

export type { AccountBookingStatus as AccountDiagnosticsBookingStatusLabel };

export function resolveAccountDiagnosticsBookingStatusLabel(
  row: VisitorQuizSessionSummary,
): AccountBookingStatus {
  return resolveAccountBookingStatusFromSummary(row);
}

/** Pending bookings may retain slot data server-side; hide it until payment confirms. */
export function shouldShowAccountDiagnosticsScheduledSession(
  row: VisitorQuizSessionSummary,
): boolean {
  return resolveAccountBookingStatusFromSummary(row) !== 'pending';
}
