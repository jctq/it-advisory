import Image from 'next/image';
import type { ReactElement } from 'react';
import {
  brandAssetUrl,
  BRAND_LOGO_COMPACT_DARK,
  BRAND_LOGO_COMPACT_LIGHT,
  BRAND_LOGO_FULL_DARK,
  BRAND_LOGO_FULL_LIGHT,
} from '@/lib/brand/brand-assets';

// Intrinsic pixels from `scripts/generate-techmd-brand-assets.py` — updated after regen.
const LOGO_LIGHT_WIDTH_PX = 1590;
const LOGO_LIGHT_HEIGHT_PX = 374;
const LOGO_DARK_WIDTH_PX = 1588;
const LOGO_DARK_HEIGHT_PX = 374;

const LOGO_IMAGE_CLASS =
  'block h-9 w-auto max-w-none object-contain object-left sm:h-10 lg:h-11';

/**
 * Responsive TEQMD logo for the marketing header: full wordmark + tagline on large screens,
 * compact wordmark (no tagline) on smaller breakpoints. Light/dark pairs share one slot
 * (`dark:hidden` / `hidden dark:block`), same pattern as the admin sidebar.
 */
export function TechmdSiteLogo(): ReactElement {
  return (
    <span className="inline-flex shrink-0 items-center overflow-visible">
      <span className="hidden lg:contents">
        <Image
          src={brandAssetUrl(BRAND_LOGO_FULL_LIGHT)}
          alt="TEQMD — Technology consultation. Better decisions. Stronger business."
          width={LOGO_LIGHT_WIDTH_PX}
          height={LOGO_LIGHT_HEIGHT_PX}
          priority
          sizes="(min-width: 1024px) 384px, 1px"
          className={`${LOGO_IMAGE_CLASS} dark:hidden`}
        />
        <Image
          src={brandAssetUrl(BRAND_LOGO_FULL_DARK)}
          alt="TEQMD — Technology consultation. Better decisions. Stronger business."
          width={LOGO_DARK_WIDTH_PX}
          height={LOGO_DARK_HEIGHT_PX}
          priority
          sizes="(min-width: 1024px) 384px, 1px"
          className={`${LOGO_IMAGE_CLASS} hidden dark:block`}
        />
      </span>
      <span className="lg:hidden">
        <Image
          src={brandAssetUrl(BRAND_LOGO_COMPACT_LIGHT)}
          alt="TEQMD"
          width={LOGO_LIGHT_WIDTH_PX}
          height={LOGO_LIGHT_HEIGHT_PX}
          priority
          sizes="(max-width: 1023px) 288px, 1px"
          className={`${LOGO_IMAGE_CLASS} dark:hidden`}
        />
        <Image
          src={brandAssetUrl(BRAND_LOGO_COMPACT_DARK)}
          alt="TEQMD"
          width={LOGO_DARK_WIDTH_PX}
          height={LOGO_DARK_HEIGHT_PX}
          priority
          sizes="(max-width: 1023px) 288px, 1px"
          className={`${LOGO_IMAGE_CLASS} hidden dark:block`}
        />
      </span>
    </span>
  );
}
