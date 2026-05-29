import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';
import {
  resolveAccountBookingStatusFromSummary,
  type AccountBookingStatus,
} from '@/lib/marketing/account-booking-status';

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

export type AccountDiagnosticsSessionActionId = 'view' | 'manage' | 'continue' | 'delete';

function isTerminalPaymentStatus(
  status: VisitorQuizSessionSummary['paymentTransactionStatus'],
): boolean {
  return status === 'expired' || status === 'failed';
}

/** True when payment failed or expired — route manage to booking management when possible. */
export function isSessionPaymentExpiredForManage(row: VisitorQuizSessionSummary): boolean {
  if (isTerminalPaymentStatus(row.paymentTransactionStatus)) {
    return true;
  }
  if (row.bookingStatus === 'cancelled' && row.paymentTransactionStatus !== 'paid') {
    return true;
  }
  return false;
}

/** True when checkout is in progress (user started payment). */
export function isSessionAwaitingPayment(row: VisitorQuizSessionSummary): boolean {
  return resolveAccountBookingStatusFromSummary(row) === 'awaiting_payment';
}

/** True when the booking is confirmed or completed. */
export function isSessionConfirmedForManage(row: VisitorQuizSessionSummary): boolean {
  const status = resolveAccountBookingStatusFromSummary(row);
  return status === 'confirmed' || status === 'completed';
}

/**
 * Primary actions for a diagnostics list row (My diagnostics).
 *
 * Delete is always offered; linked bookings are cancelled so the slot is released.
 *
 * - awaiting_payment → manage, delete
 * - pending + incomplete diagnostic → continue, delete
 * - pending + complete diagnostic → manage, delete
 * - confirmed / completed → view, delete
 * - cancelled → view, delete
 */
export function resolveAccountDiagnosticsSessionActions(
  row: VisitorQuizSessionSummary,
): readonly AccountDiagnosticsSessionActionId[] {
  const lifecycleStatus = resolveAccountBookingStatusFromSummary(row);
  if (lifecycleStatus === 'cancelled') {
    return ['view', 'delete'];
  }
  if (lifecycleStatus === 'confirmed' || lifecycleStatus === 'completed') {
    return ['view', 'delete'];
  }
  if (lifecycleStatus === 'awaiting_payment') {
    return ['manage', 'delete'];
  }
  if (!row.isDiagnosticComplete) {
    return ['continue', 'delete'];
  }
  return ['manage', 'delete'];
}

export function buildBookManageHref(bookingId: string | null): string {
  if (bookingId !== null && MONGO_OBJECT_ID_HEX.test(bookingId)) {
    return `/book/manage?bookingId=${encodeURIComponent(bookingId)}`;
  }
  return '/book/manage';
}

/** Marketing checkout path to resume payment for this diagnostic session. */
export function buildSessionAwaitingPaymentBookHref(row: VisitorQuizSessionSummary): string {
  const serviceKey = row.bookingServiceKey ?? row.checkoutServiceKey;
  return buildMarketingBookSessionPath(row.marketingSessionRef, serviceKey);
}

/** Manage href for pending rows with a completed diagnostic (checkout or booking management). */
export function buildSessionManageHref(
  row: VisitorQuizSessionSummary,
  manageBookingEnabled: boolean,
): string {
  const lifecycleStatus = resolveAccountBookingStatusFromSummary(row);
  if (lifecycleStatus === 'awaiting_payment') {
    return buildSessionAwaitingPaymentBookHref(row);
  }
  if (
    manageBookingEnabled &&
    row.bookingId !== null &&
    (isSessionPaymentExpiredForManage(row) || lifecycleStatus === 'pending')
  ) {
    return buildBookManageHref(row.bookingId);
  }
  return buildSessionAwaitingPaymentBookHref(row);
}

export function resolveAccountDiagnosticsSessionActionLifecycleStatus(
  row: VisitorQuizSessionSummary,
): AccountBookingStatus {
  return resolveAccountBookingStatusFromSummary(row);
}
