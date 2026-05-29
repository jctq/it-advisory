import type { Document } from 'mongodb';
import type { PaymentStatus } from '@/domain/payment-types';
import type { BookingDocument } from '@/domain/types';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';

/**
 * Canonical booking lifecycle status for account diagnostics and admin calendar filters.
 * Diagnostic completion is separate (`isDiagnosticComplete`); these reflect booking/payment only.
 */
export const ACCOUNT_BOOKING_STATUS_VALUES = [
  'cancelled',
  'pending',
  'confirmed',
  'completed',
  'awaiting_payment',
] as const;

export type AccountBookingStatus = (typeof ACCOUNT_BOOKING_STATUS_VALUES)[number];

export type BookingListStatusFilter = 'all' | AccountBookingStatus;

export const BOOKING_LIST_STATUS_FILTER_OPTIONS: readonly {
  readonly id: BookingListStatusFilter;
  readonly label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'awaiting_payment', label: 'Awaiting payment' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

export function normalizeBookingListStatusFilter(raw: string): BookingListStatusFilter {
  if (
    raw === 'all' ||
    raw === 'cancelled' ||
    raw === 'pending' ||
    raw === 'confirmed' ||
    raw === 'completed' ||
    raw === 'awaiting_payment'
  ) {
    return raw;
  }
  return 'pending';
}

function isOpenCheckoutPaymentStatus(status: PaymentStatus | null | undefined): boolean {
  return status === 'pending' || status === 'processing';
}

export type ResolveAccountBookingStatusInput = {
  readonly bookingStatus: BookingDocument['status'] | null;
  readonly paymentTransactionStatus: PaymentStatus | null;
  readonly isDiagnosticComplete: boolean;
  readonly isBooked: boolean;
};

/**
 * Resolves one of the five booking lifecycle statuses for a diagnostics row.
 */
export function resolveAccountBookingStatus(input: ResolveAccountBookingStatusInput): AccountBookingStatus {
  const bookingStatus = input.bookingStatus;
  const paymentStatus = input.paymentTransactionStatus;
  if (bookingStatus === 'cancelled') {
    return 'cancelled';
  }
  if (bookingStatus === 'completed') {
    return 'completed';
  }
  if (bookingStatus === 'confirmed' || paymentStatus === 'paid') {
    return 'confirmed';
  }
  if (isOpenCheckoutPaymentStatus(paymentStatus)) {
    return 'awaiting_payment';
  }
  return 'pending';
}

export function resolveAccountBookingStatusFromSummary(
  row: VisitorQuizSessionSummary,
): AccountBookingStatus {
  return resolveAccountBookingStatus({
    bookingStatus: row.bookingStatus,
    paymentTransactionStatus: row.paymentTransactionStatus,
    isDiagnosticComplete: row.isDiagnosticComplete,
    isBooked: row.isBooked,
  });
}

export type ResolveAdminBookingLifecycleStatusInput = {
  readonly status: BookingDocument['status'];
  readonly paymentStatus: PaymentStatus | null;
  readonly paymentTransactionId: string | null;
};

/** Same five statuses for admin calendar rows (booking document + payment fields). */
export function resolveAdminBookingLifecycleStatus(
  input: ResolveAdminBookingLifecycleStatusInput,
): AccountBookingStatus {
  if (input.status === 'cancelled') {
    return 'cancelled';
  }
  if (input.status === 'completed') {
    return 'completed';
  }
  if (input.status === 'confirmed' || input.paymentStatus === 'paid') {
    return 'confirmed';
  }
  const hasCheckout =
    input.paymentTransactionId !== null &&
    input.paymentTransactionId.trim().length > 0 &&
    isOpenCheckoutPaymentStatus(input.paymentStatus);
  if (input.status === 'pending' && input.paymentTransactionId !== null && input.paymentTransactionId.trim().length > 0) {
    if (hasCheckout || input.paymentStatus === null) {
      return 'awaiting_payment';
    }
  }
  return 'pending';
}

/** Mongo match for paginated account diagnostics (`latestPaymentStatus` from pipeline lookup). */
export function buildAccountDiagnosticsBookingStatusMatch(status: BookingListStatusFilter): Document {
  if (status === 'all') {
    return {};
  }
  if (status === 'cancelled') {
    return { 'linkedBooking.status': 'cancelled' };
  }
  if (status === 'completed') {
    return { 'linkedBooking.status': 'completed' };
  }
  if (status === 'confirmed') {
    return {
      $or: [{ 'linkedBooking.status': 'confirmed' }, { latestPaymentStatus: 'paid' }],
    };
  }
  if (status === 'awaiting_payment') {
    return {
      latestPaymentStatus: { $in: ['pending', 'processing'] },
      'linkedBooking.status': { $nin: ['cancelled', 'completed', 'confirmed'] },
    };
  }
  return {
    $and: [
      {
        $or: [{ linkedBooking: null }, { 'linkedBooking.status': 'pending' }],
      },
      {
        $or: [
          { latestPaymentStatus: null },
          { latestPaymentStatus: { $in: ['failed', 'expired'] } },
        ],
      },
      { 'linkedBooking.status': { $nin: ['cancelled', 'completed', 'confirmed'] } },
    ],
  };
}

export function buildAdminBookingsRangeStatusQuery(
  status: BookingListStatusFilter,
): Record<string, unknown> | null {
  if (status === 'all') {
    return null;
  }
  if (status === 'cancelled' || status === 'completed' || status === 'confirmed') {
    return { status };
  }
  if (status === 'awaiting_payment') {
    return {
      status: 'pending',
      paymentTransactionId: { $ne: null },
      $or: [
        { paymentStatus: null },
        { paymentStatus: { $in: ['pending', 'processing'] } },
      ],
    };
  }
  return {
    status: 'pending',
    $or: [
      { paymentTransactionId: null },
      { paymentTransactionId: { $exists: false } },
      { paymentStatus: { $in: ['failed', 'expired', null] } },
    ],
  };
}
