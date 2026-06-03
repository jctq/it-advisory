import { describe, expect, it } from 'vitest';
import {
  assertCheckoutLineItemsTotal,
  formatLineItemsDescription,
  resolveCheckoutLineItems,
  sumLineItemsCentavos,
} from './checkout-line-items';
import type { CreateCheckoutSessionInput } from './types';

const baseInput: CreateCheckoutSessionInput = {
  amountCentavos: 650_000,
  currency: 'PHP',
  description: 'TeqMD Consultation Booking',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
  referenceId: 'draft-1',
  metadata: {},
  sandboxMode: true,
  paymentMethodId: 'card',
};

describe('resolveCheckoutLineItems', () => {
  it('falls back to a single summary line when lineItems is omitted', () => {
    const lineItems = resolveCheckoutLineItems(baseInput);
    expect(lineItems).toEqual([
      { name: 'TeqMD Consultation Booking', amountCentavos: 650_000, quantity: 1 },
    ]);
  });

  it('returns provided line items when present', () => {
    const lineItems = resolveCheckoutLineItems({
      ...baseInput,
      lineItems: [
        { name: 'Project Rescue Consultation', amountCentavos: 600_000, quantity: 1 },
        { name: 'AI meeting notes & recording', amountCentavos: 50_000, quantity: 1 },
      ],
    });
    expect(lineItems).toHaveLength(2);
    expect(sumLineItemsCentavos(lineItems)).toBe(650_000);
  });
});

describe('assertCheckoutLineItemsTotal', () => {
  it('accepts line items that sum to the checkout amount', () => {
    const lineItems = assertCheckoutLineItemsTotal({
      ...baseInput,
      lineItems: [
        { name: 'Service', amountCentavos: 600_000, quantity: 1 },
        { name: 'Add-on', amountCentavos: 50_000, quantity: 1 },
      ],
    });
    expect(lineItems).toHaveLength(2);
  });

  it('throws when line items do not match the checkout amount', () => {
    expect(() =>
      assertCheckoutLineItemsTotal({
        ...baseInput,
        lineItems: [{ name: 'Service', amountCentavos: 600_000, quantity: 1 }],
      }),
    ).toThrow(/does not match payment amount/);
  });
});

describe('formatLineItemsDescription', () => {
  it('joins line item names', () => {
    const description = formatLineItemsDescription([
      { name: 'Project Rescue Consultation (SAVE10)', amountCentavos: 540_000 },
      { name: 'AI meeting notes & recording', amountCentavos: 50_000 },
    ]);
    expect(description).toBe('Project Rescue Consultation (SAVE10) · AI meeting notes & recording');
  });
});
