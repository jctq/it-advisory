import type { BookingDocument } from '@/domain/types';
import type { PaymentStatus } from '@/domain/payment-types';

const BOOKING_STATUS_RANK: Readonly<Record<BookingDocument['status'], number>> = {
  completed: 6,
  confirmed: 5,
  refund_awaiting: 4,
  refunded: 3,
  pending: 2,
  cancelled: 1,
};

export type BookingRowForPrimaryPick = {
  readonly status: BookingDocument['status'];
  readonly updatedAt?: Date;
  readonly paymentStatus?: PaymentStatus | null;
};

function resolveBookingStatusRank(status: BookingDocument['status']): number {
  return BOOKING_STATUS_RANK[status] ?? 0;
}

/** Among pending rows, prefer an active checkout hold over a stale expired hold. */
function resolvePendingCheckoutPriority(row: BookingRowForPrimaryPick): number {
  if (row.status !== 'pending') {
    return 0;
  }
  const paymentStatus = row.paymentStatus;
  if (paymentStatus === 'pending' || paymentStatus === 'processing') {
    return 2;
  }
  if (paymentStatus === 'expired' || paymentStatus === 'failed') {
    return 0;
  }
  return 1;
}

/**
 * Chooses the booking row account diagnostics and checkout should treat as canonical when several
 * reference the same diagnostic session (prefers completed/confirmed over stale pending duplicates).
 */
export function pickPrimaryBookingForDiagnosticSession<T extends BookingRowForPrimaryPick>(
  candidates: readonly T[],
): T | null {
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((best, current) => {
    const bestRank = resolveBookingStatusRank(best.status);
    const currentRank = resolveBookingStatusRank(current.status);
    if (currentRank > bestRank) {
      return current;
    }
    if (currentRank < bestRank) {
      return best;
    }
    if (currentRank === bestRank) {
      const bestPendingPriority = resolvePendingCheckoutPriority(best);
      const currentPendingPriority = resolvePendingCheckoutPriority(current);
      if (currentPendingPriority > bestPendingPriority) {
        return current;
      }
      if (currentPendingPriority < bestPendingPriority) {
        return best;
      }
    }
    const bestUpdatedAt = best.updatedAt?.getTime() ?? 0;
    const currentUpdatedAt = current.updatedAt?.getTime() ?? 0;
    return currentUpdatedAt > bestUpdatedAt ? current : best;
  });
}

export function normalizeBookingDocumentStatus(
  status: BookingDocument['status'] | undefined,
): BookingDocument['status'] | null {
  if (
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'completed' ||
    status === 'cancelled' ||
    status === 'refund_awaiting' ||
    status === 'refunded'
  ) {
    return status;
  }
  return null;
}
