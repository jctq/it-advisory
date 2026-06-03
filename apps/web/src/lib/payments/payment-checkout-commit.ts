import type { PaymentStatus } from '@/domain/payment-types';

export const PAYMENT_CHECKOUT_COMMITTED_METADATA_KEY = 'checkoutCommitted';

/**
 * Whether the visitor clicked Pay (vs. prepare pre-warm only). Legacy rows without the flag count as committed.
 */
export function isPaymentCheckoutCommitted(metadata?: Record<string, string>): boolean {
  const raw = metadata?.[PAYMENT_CHECKOUT_COMMITTED_METADATA_KEY];
  if (raw === undefined) {
    return true;
  }
  return raw === 'true';
}

/**
 * Maps open checkout statuses to null until the visitor commits on Pay.
 */
export function resolvePaymentStatusForCustomerLifecycle(
  status: PaymentStatus | null | undefined,
  metadata?: Record<string, string>,
): PaymentStatus | null {
  if (status === undefined || status === null) {
    return null;
  }
  if (status !== 'pending' && status !== 'processing') {
    return status;
  }
  return isPaymentCheckoutCommitted(metadata) ? status : null;
}

export function buildCheckoutCommittedMetadata(
  base: Record<string, string>,
  checkoutCommitted: boolean,
): Record<string, string> {
  return {
    ...base,
    [PAYMENT_CHECKOUT_COMMITTED_METADATA_KEY]: checkoutCommitted ? 'true' : 'false',
  };
}
