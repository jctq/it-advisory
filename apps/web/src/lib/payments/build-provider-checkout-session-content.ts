import type { CheckoutSessionLineItem } from '@teqmd/payments';
import type { ResolvedCheckoutAmount } from '@/lib/payments/resolve-checkout-amount';

const RECORDING_LINE_ITEM_NAME = 'AI meeting notes & recording' as const;

export type ProviderCheckoutSessionContent = {
  readonly description: string;
  readonly lineItems: readonly CheckoutSessionLineItem[];
};

function buildServiceLineName(serviceTitle: string, appliedPromoCode: string | undefined): string {
  const trimmedTitle = serviceTitle.trim();
  const title = trimmedTitle.length > 0 ? trimmedTitle : 'Consultation';
  const promoCode = appliedPromoCode?.trim() ?? '';
  if (promoCode.length === 0) {
    return title;
  }
  return `${title} (${promoCode})`;
}

/**
 * Builds itemized provider checkout content from resolved pricing and a service title.
 */
export function buildProviderCheckoutSessionContent(input: {
  readonly serviceTitle: string;
  readonly resolvedPricing: ResolvedCheckoutAmount;
}): ProviderCheckoutSessionContent {
  const discountedServiceCentavos =
    input.resolvedPricing.amountCentavos - input.resolvedPricing.recordingSurchargeCentavos;
  const lineItems: CheckoutSessionLineItem[] = [
    {
      name: buildServiceLineName(input.serviceTitle, input.resolvedPricing.appliedPromoCode),
      amountCentavos: discountedServiceCentavos,
      quantity: 1,
    },
  ];
  if (input.resolvedPricing.recordingSurchargeCentavos > 0) {
    lineItems.push({
      name: RECORDING_LINE_ITEM_NAME,
      amountCentavos: input.resolvedPricing.recordingSurchargeCentavos,
      quantity: 1,
    });
  }
  const description = lineItems.map((item) => item.name).join(' · ');
  return { description, lineItems };
}
