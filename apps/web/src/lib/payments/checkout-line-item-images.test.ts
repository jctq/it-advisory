import { describe, expect, it } from 'vitest';
import { resolveCheckoutLineItemImageUrl } from './checkout-line-item-images';

describe('resolveCheckoutLineItemImageUrl', () => {
  it('builds absolute URLs for consultation and recording assets', () => {
    expect(resolveCheckoutLineItemImageUrl('https://teqmd.com/', 'consultation')).toBe(
      'https://teqmd.com/checkout/line-items/consultation.png?v=3',
    );
    expect(resolveCheckoutLineItemImageUrl('https://teqmd.com', 'recording')).toBe(
      'https://teqmd.com/checkout/line-items/recording.png?v=3',
    );
  });
});
