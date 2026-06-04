export const CHECKOUT_LINE_ITEM_CONSULTATION_IMAGE_PATH = '/checkout/line-items/consultation.png' as const;
export const CHECKOUT_LINE_ITEM_RECORDING_IMAGE_PATH = '/checkout/line-items/recording.png' as const;

export type CheckoutLineItemImageKind = 'consultation' | 'recording';

/**
 * Builds an absolute URL for a hosted checkout line-item product image.
 */
export function resolveCheckoutLineItemImageUrl(
  assetBaseUrl: string,
  kind: CheckoutLineItemImageKind,
): string {
  const base = assetBaseUrl.trim().replace(/\/$/, '');
  const path =
    kind === 'recording' ? CHECKOUT_LINE_ITEM_RECORDING_IMAGE_PATH : CHECKOUT_LINE_ITEM_CONSULTATION_IMAGE_PATH;
  return `${base}${path}`;
}
