import type { BookingDocument } from '@/domain/types';

const BOOKING_STATUS_RANK: Readonly<Record<BookingDocument['status'], number>> = {
  completed: 4,
  confirmed: 3,
  pending: 2,
  cancelled: 1,
};

export type BookingRowForPrimaryPick = {
  readonly status: BookingDocument['status'];
  readonly updatedAt?: Date;
};

function resolveBookingStatusRank(status: BookingDocument['status']): number {
  return BOOKING_STATUS_RANK[status] ?? 0;
}

/**
 * Chooses the booking row account diagnostics and checkout should treat as canonical when several
 * reference the same quiz session (prefers completed/confirmed over stale pending duplicates).
 */
export function pickPrimaryBookingForQuizSession<T extends BookingRowForPrimaryPick>(
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
    status === 'cancelled'
  ) {
    return status;
  }
  return null;
}
