import { buildMarketingBookSessionPath } from '@/lib/marketing/diagnostic-session-marketing-ref';
import type { VisitorDiagnosticSessionSummary } from '@/lib/data/diagnostic-session-types';
import type { PaymentPolicy } from '@/domain/payment-types';
import {
  isBookingPaidForCustomerAction,
  resolveBookingCustomerActionMode,
  type BookingCustomerActionMode,
} from '@/lib/booking/booking-customer-action-eligibility';
import {
  resolveAccountBookingStatusFromSummary,
  type AccountBookingStatus,
} from '@/lib/marketing/account-booking-status';
import { resolveCanDeleteDiagnosticSession } from '@/lib/marketing/diagnostic-session-linked-booking';

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

export type AccountDiagnosticsSessionActionId =
  | 'view'
  | 'manage'
  | 'continue'
  | 'cancel'
  | 'refund'
  | 'delete';

function rowHasDiagnosticContent(row: VisitorDiagnosticSessionSummary): boolean {
  if (row.hasGuidedDiagnostic) {
    return true;
  }
  if (row.situationPreview !== null && row.situationPreview.trim().length > 0) {
    return true;
  }
  if (row.sessionTitlePreview !== null && row.sessionTitlePreview.trim().length > 0) {
    return true;
  }
  return row.currentStep > 0;
}

export function resolveAccountDiagnosticsCanDeleteSession(row: VisitorDiagnosticSessionSummary): boolean {
  return resolveCanDeleteDiagnosticSession({
    hasDiagnosticContent: rowHasDiagnosticContent(row),
    bookingStatus: row.bookingStatus,
    paymentTransactionStatus: row.paymentTransactionStatus,
    isDiagnosticComplete: row.isDiagnosticComplete,
    isBooked: row.isBooked,
  });
}

function appendDeleteWhenEligible(
  actions: readonly AccountDiagnosticsSessionActionId[],
  row: VisitorDiagnosticSessionSummary,
): readonly AccountDiagnosticsSessionActionId[] {
  if (!resolveAccountDiagnosticsCanDeleteSession(row)) {
    return actions;
  }
  return [...actions, 'delete'];
}

function isTerminalPaymentStatus(
  status: VisitorDiagnosticSessionSummary['paymentTransactionStatus'],
): boolean {
  return status === 'expired' || status === 'failed';
}

/** True when payment failed or expired — route manage to booking management when possible. */
export function isSessionPaymentExpiredForManage(row: VisitorDiagnosticSessionSummary): boolean {
  if (isTerminalPaymentStatus(row.paymentTransactionStatus)) {
    return true;
  }
  if (row.bookingStatus === 'cancelled' && row.paymentTransactionStatus !== 'paid') {
    return true;
  }
  return false;
}

/** True when checkout is in progress (user started payment). */
export function isSessionAwaitingPayment(row: VisitorDiagnosticSessionSummary): boolean {
  return resolveAccountBookingStatusFromSummary(row) === 'awaiting_payment';
}

/** True when the booking is confirmed or completed. */
export function isSessionConfirmedForManage(row: VisitorDiagnosticSessionSummary): boolean {
  const status = resolveAccountBookingStatusFromSummary(row);
  return status === 'confirmed' || status === 'completed';
}

export type AccountDiagnosticsSessionActionsOptions = {
  readonly paymentPolicy: PaymentPolicy;
  readonly refundsEnabled?: boolean;
};

function resolveCustomerActionForRow(
  row: VisitorDiagnosticSessionSummary,
  options: AccountDiagnosticsSessionActionsOptions,
): BookingCustomerActionMode | null {
  if (row.bookingStatus === null) {
    return null;
  }
  return resolveBookingCustomerActionMode({
    paymentPolicy: options.paymentPolicy,
    bookingStatus: row.bookingStatus,
    isPaid: isBookingPaidForCustomerAction({
      bookingPaymentStatus: row.bookingPaymentStatus,
      paymentTransactionStatus: row.paymentTransactionStatus,
    }),
    refundsEnabled: options.refundsEnabled,
  });
}

function appendCustomerAction(
  actions: readonly AccountDiagnosticsSessionActionId[],
  mode: BookingCustomerActionMode | null,
): readonly AccountDiagnosticsSessionActionId[] {
  if (mode === 'cancel') {
    return [...actions, 'cancel'];
  }
  if (mode === 'refund') {
    return [...actions, 'refund'];
  }
  return actions;
}

/**
 * Primary actions for a diagnostics list row (My diagnostics).
 *
 * - awaiting_payment → manage
 * - pending + incomplete diagnostic → continue (+ delete when eligible)
 * - pending + complete diagnostic → manage (+ delete when eligible)
 * - confirmed → view (+ cancel or refund when eligible)
 * - completed → view only
 * - cancelled → view
 */
export function resolveAccountDiagnosticsSessionActions(
  row: VisitorDiagnosticSessionSummary,
  options: AccountDiagnosticsSessionActionsOptions,
): readonly AccountDiagnosticsSessionActionId[] {
  const lifecycleStatus = resolveAccountBookingStatusFromSummary(row);
  const customerAction = resolveCustomerActionForRow(row, options);
  if (lifecycleStatus === 'cancelled' || lifecycleStatus === 'refunded' || lifecycleStatus === 'refund_awaiting') {
    return ['view'];
  }
  if (lifecycleStatus === 'confirmed' || lifecycleStatus === 'completed') {
    return appendCustomerAction(['view'], customerAction);
  }
  if (lifecycleStatus === 'awaiting_payment') {
    return ['manage'];
  }
  if (!row.isDiagnosticComplete) {
    return appendDeleteWhenEligible(['continue'], row);
  }
  return appendDeleteWhenEligible(['manage'], row);
}

export function resolveAccountDiagnosticsSessionCustomerAction(
  row: VisitorDiagnosticSessionSummary,
  options: AccountDiagnosticsSessionActionsOptions,
): BookingCustomerActionMode | null {
  return resolveCustomerActionForRow(row, options);
}

export function buildBookManageHref(bookingId: string | null): string {
  if (bookingId !== null && MONGO_OBJECT_ID_HEX.test(bookingId)) {
    return `/book/manage?bookingId=${encodeURIComponent(bookingId)}`;
  }
  return '/book/manage';
}

/** Marketing checkout path to resume payment for this diagnostic session. */
export function buildSessionAwaitingPaymentBookHref(row: VisitorDiagnosticSessionSummary): string {
  const serviceKey = row.bookingServiceKey ?? row.checkoutServiceKey;
  return buildMarketingBookSessionPath(row.marketingSessionRef, serviceKey);
}

/** Manage href for pending rows with a completed diagnostic (checkout or booking management). */
export function buildSessionManageHref(
  row: VisitorDiagnosticSessionSummary,
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
  row: VisitorDiagnosticSessionSummary,
): AccountBookingStatus {
  return resolveAccountBookingStatusFromSummary(row);
}
