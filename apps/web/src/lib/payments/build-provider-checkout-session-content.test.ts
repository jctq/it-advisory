import { describe, expect, it } from 'vitest';
import { buildProviderCheckoutSessionContent } from './build-provider-checkout-session-content';
import type { ResolvedCheckoutAmount } from './resolve-checkout-amount';

const TEST_ASSET_BASE_URL = 'https://checkout.example.com';

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

describe('buildProviderCheckoutSessionContent', () => {
  it('builds a single service line item with a consultation product image', () => {
    const content = buildProviderCheckoutSessionContent({
      serviceTitle: 'Project Rescue Consultation',
      resolvedPricing: buildResolvedPricing(),
      assetBaseUrl: TEST_ASSET_BASE_URL,
    });
    expect(content.lineItems).toEqual([
      {
        name: 'Project Rescue Consultation',
        amountCentavos: 600_000,
        quantity: 1,
        imageUrl: 'https://checkout.example.com/checkout/line-items/consultation.png?v=3',
      },
    ]);
    expect(content.description).toBe('Project Rescue Consultation');
  });

  it('includes promo code in the service line name', () => {
    const content = buildProviderCheckoutSessionContent({
      serviceTitle: 'Project Rescue Consultation',
      resolvedPricing: buildResolvedPricing({
        amountCentavos: 540_000,
        discountCentavos: 60_000,
        discountLabel: '₱600.00',
        appliedPromoCode: 'SAVE10',
        source: 'promo',
      }),
      assetBaseUrl: TEST_ASSET_BASE_URL,
    });
    expect(content.lineItems[0]?.name).toBe('Project Rescue Consultation (SAVE10)');
    expect(content.lineItems[0]?.amountCentavos).toBe(540_000);
    expect(content.lineItems[0]?.imageUrl).toBe(
      'https://checkout.example.com/checkout/line-items/consultation.png?v=3',
    );
  });

  it('adds a recording surcharge line item with distinct product images', () => {
    const content = buildProviderCheckoutSessionContent({
      serviceTitle: 'Project Rescue Consultation',
      resolvedPricing: buildResolvedPricing({
        amountCentavos: 650_000,
        recordingOptIn: true,
        recordingSurchargeCentavos: 50_000,
        recordingSurchargeLabel: '₱500.00',
      }),
      assetBaseUrl: TEST_ASSET_BASE_URL,
    });
    expect(content.lineItems).toEqual([
      {
        name: 'Project Rescue Consultation',
        amountCentavos: 600_000,
        quantity: 1,
        imageUrl: 'https://checkout.example.com/checkout/line-items/consultation.png?v=3',
      },
      {
        name: 'AI meeting notes & recording',
        amountCentavos: 50_000,
        quantity: 1,
        imageUrl: 'https://checkout.example.com/checkout/line-items/recording.png?v=3',
      },
    ]);
    expect(content.description).toBe('Project Rescue Consultation · AI meeting notes & recording');
  });
});
