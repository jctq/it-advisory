import { describe, expect, it } from 'vitest';
import {
  isPaymentCheckoutCommitted,
  resolvePaymentStatusForCustomerLifecycle,
} from '@/lib/payments/payment-checkout-commit';

describe('payment checkout commit', () => {
  it('treats legacy transactions without metadata as committed', () => {
    expect(isPaymentCheckoutCommitted(undefined)).toBe(true);
    expect(isPaymentCheckoutCommitted({})).toBe(true);
  });

  it('returns null for uncommitted open checkout statuses', () => {
    expect(
      resolvePaymentStatusForCustomerLifecycle('pending', { checkoutCommitted: 'false' }),
    ).toBeNull();
    expect(
      resolvePaymentStatusForCustomerLifecycle('processing', { checkoutCommitted: 'false' }),
    ).toBeNull();
  });

  it('returns open statuses when checkout is committed', () => {
    expect(
      resolvePaymentStatusForCustomerLifecycle('pending', { checkoutCommitted: 'true' }),
    ).toBe('pending');
  });

  it('passes through terminal statuses regardless of commit flag', () => {
    expect(
      resolvePaymentStatusForCustomerLifecycle('paid', { checkoutCommitted: 'false' }),
    ).toBe('paid');
  });
});
