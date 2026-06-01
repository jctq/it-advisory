import type { PaymentPolicy, PaymentStatus } from '@/domain/payment-types';
import type { BookingDocument } from '@/domain/types';

export type BookingCustomerActionMode = 'cancel' | 'refund';

export type ResolveBookingCustomerActionModeInput = {
  readonly paymentPolicy: PaymentPolicy;
  readonly bookingStatus: BookingDocument['status'];
  readonly isPaid: boolean;
  readonly refundsEnabled?: boolean;
};

function normalizePaymentPolicyForCustomerAction(policy: PaymentPolicy): PaymentPolicy {
  if (policy === 'pay_before_booking') {
    return 'pay_after_hold';
  }
  return policy;
}

export function isBookingPaidForCustomerAction(input: {
  readonly bookingPaymentStatus: PaymentStatus | null | undefined;
  readonly paymentTransactionStatus: PaymentStatus | null | undefined;
}): boolean {
  return input.bookingPaymentStatus === 'paid' || input.paymentTransactionStatus === 'paid';
}

function isRefundableBookingStatus(status: BookingDocument['status'], isPaid: boolean): boolean {
  if (status === 'confirmed') {
    return true;
  }
  return status === 'pending' && isPaid;
}

/**
 * Whether a customer may cancel (manual confirm) or request a refund (reserve then pay + paid).
 */
export function resolveBookingCustomerActionMode(
  input: ResolveBookingCustomerActionModeInput,
): BookingCustomerActionMode | null {
  if (
    input.bookingStatus === 'cancelled' ||
    input.bookingStatus === 'refund_awaiting' ||
    input.bookingStatus === 'refunded'
  ) {
    return null;
  }
  const policy = normalizePaymentPolicyForCustomerAction(input.paymentPolicy);
  const refundsEnabled = input.refundsEnabled !== false;
  if (
    refundsEnabled &&
    input.isPaid &&
    isRefundableBookingStatus(input.bookingStatus, input.isPaid)
  ) {
    if (policy === 'pay_after_hold' || policy === 'manual_confirm') {
      return 'refund';
    }
  }
  if (policy === 'manual_confirm') {
    return input.bookingStatus === 'confirmed' ? 'cancel' : null;
  }
  return null;
}
