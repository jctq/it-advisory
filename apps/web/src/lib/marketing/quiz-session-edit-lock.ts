import type { PaymentStatus } from '@/domain/payment-types';

/**
 * Whether a diagnostic session must stay read-only (checkout open, paid, or linked booking).
 */
export function isQuizSessionEditingLocked(input: {
  readonly bookedCount: number;
  readonly latestPaymentStatus: PaymentStatus | null;
}): boolean {
  if (input.bookedCount > 0) {
    return true;
  }
  const status = input.latestPaymentStatus;
  return status === 'pending' || status === 'processing' || status === 'paid';
}
