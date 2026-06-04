import { formatPaymentAmountLabel } from '@/lib/data/payment-settings';
import type { BookingPaymentBreakdown } from '@/lib/payments/booking-payment-breakdown-types';
import type { ResolvedCheckoutAmount } from '@/lib/payments/resolve-checkout-amount';

/**
 * Maps resolved checkout pricing to admin payment breakdown fields.
 */
export function buildBookingPaymentBreakdownFromResolved(input: {
  readonly serviceTitle: string;
  readonly resolvedPricing: ResolvedCheckoutAmount;
  readonly totalCentavos: number;
}): BookingPaymentBreakdown {
  return {
    serviceTitle: input.serviceTitle,
    subtotalAmountLabel: input.resolvedPricing.subtotalAmountLabel,
    discountCentavos: input.resolvedPricing.discountCentavos,
    discountLabel: input.resolvedPricing.discountLabel,
    appliedPromoCode: input.resolvedPricing.appliedPromoCode ?? null,
    recordingSurchargeLabel: input.resolvedPricing.recordingSurchargeLabel,
    totalLabel: formatPaymentAmountLabel(input.totalCentavos),
  };
}
