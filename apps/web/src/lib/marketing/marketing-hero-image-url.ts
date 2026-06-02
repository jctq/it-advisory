/** Bump when replacing files under `public/marketing/hero/` so Next/Image and browsers fetch the new asset. */
export const MARKETING_HERO_IMAGE_VERSION = '20260602-team-analytics' as const;

/**
 * Public URL for a marketing hero raster with a cache-busting query param.
 */
export function marketingHeroImageUrl(path: string): string {
  const normalized = path.startsWith('/marketing/hero/')
    ? path
    : `/marketing/hero/${path.replace(/^\//, '')}`;
  return `${normalized}?v=${MARKETING_HERO_IMAGE_VERSION}`;
}
