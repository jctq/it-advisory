import type { CheckoutSessionLineItem } from '@teqmd/payments';
import {
  buildProviderCheckoutSessionContent,
  type ProviderCheckoutSessionContent,
} from '@/lib/payments/build-provider-checkout-session-content';
import type { ResolvedCheckoutAmount } from '@/lib/payments/resolve-checkout-amount';
import { resolveCheckoutServiceTitle } from '@/lib/payments/resolve-checkout-service-title';

export type { ProviderCheckoutSessionContent };

/**
 * Resolves the service title and builds itemized provider checkout content.
 */
export async function resolveProviderCheckoutSessionContent(input: {
  readonly serviceKey: string;
  readonly resolvedPricing: ResolvedCheckoutAmount;
  readonly assetBaseUrl: string;
}): Promise<ProviderCheckoutSessionContent> {
  const serviceTitle = await resolveCheckoutServiceTitle(input.serviceKey);
  return buildProviderCheckoutSessionContent({
    serviceTitle,
    resolvedPricing: input.resolvedPricing,
    assetBaseUrl: input.assetBaseUrl,
  });
}
