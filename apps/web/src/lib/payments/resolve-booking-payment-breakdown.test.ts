import { describe, expect, it } from 'vitest';
import type { BookingPaymentBreakdown } from './booking-payment-breakdown-types';
import { buildBookingPaymentBreakdownFromResolved } from './build-booking-payment-breakdown';
import type { ResolvedCheckoutAmount } from './resolve-checkout-amount';

function buildResolvedPricing(overrides: Partial<ResolvedCheckoutAmount> = {}): ResolvedCheckoutAmount {
  return {
    amountCentavos: 600_000,
    amountLabel: '₱6,000.00',
    subtotalAmountCentavos: 600_000,
    subtotalAmountLabel: '₱6,000.00',
    discountCentavos: 0,
    discountLabel: null,
    source: 'catalog',
    recordingOptIn: false,
    recordingSurchargeCentavos: 0,
    recordingSurchargeLabel: null,
    ...overrides,
  };
}

describe('buildBookingPaymentBreakdownFromResolved', () => {
  it('maps catalog pricing without discount or recording', () => {
    const breakdown: BookingPaymentBreakdown = buildBookingPaymentBreakdownFromResolved({
      serviceTitle: 'Project Rescue Consultation',
      resolvedPricing: buildResolvedPricing(),
      totalCentavos: 600_000,
    });
    expect(breakdown.serviceTitle).toBe('Project Rescue Consultation');
    expect(breakdown.subtotalAmountLabel).toBe('₱6,000.00');
    expect(breakdown.discountCentavos).toBe(0);
    expect(breakdown.discountLabel).toBeNull();
    expect(breakdown.appliedPromoCode).toBeNull();
    expect(breakdown.recordingSurchargeLabel).toBeNull();
    expect(breakdown.totalLabel).toBe('₱6,000.00');
  });

  it('includes promo discount and recording surcharge', () => {
    const breakdown = buildBookingPaymentBreakdownFromResolved({
      serviceTitle: 'Project Rescue Consultation',
      resolvedPricing: buildResolvedPricing({
        amountCentavos: 590_000,
        subtotalAmountCentavos: 600_000,
        discountCentavos: 60_000,
        discountLabel: '₱600.00',
        appliedPromoCode: 'SAVE10',
        source: 'promo',
        recordingOptIn: true,
        recordingSurchargeCentavos: 50_000,
        recordingSurchargeLabel: '₱500.00',
      }),
      totalCentavos: 590_000,
    });
    expect(breakdown.discountCentavos).toBe(60_000);
    expect(breakdown.discountLabel).toBe('₱600.00');
    expect(breakdown.appliedPromoCode).toBe('SAVE10');
    expect(breakdown.recordingSurchargeLabel).toBe('₱500.00');
    expect(breakdown.totalLabel).toBe('₱5,900.00');
  });
});
