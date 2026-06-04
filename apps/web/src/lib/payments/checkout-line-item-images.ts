/** PayMongo line-item image size (max 128×128). Source: matching `.svg` in public. */
export const CHECKOUT_LINE_ITEM_IMAGE_SIZE_PX = 128 as const;
export const CHECKOUT_LINE_ITEM_CONSULTATION_IMAGE_PATH = '/checkout/line-items/consultation.png' as const;
export const CHECKOUT_LINE_ITEM_RECORDING_IMAGE_PATH = '/checkout/line-items/recording.png' as const;
const CHECKOUT_LINE_ITEM_IMAGE_CACHE_VERSION = '3' as const;

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
  return `${base}${path}?v=${CHECKOUT_LINE_ITEM_IMAGE_CACHE_VERSION}`;
}
