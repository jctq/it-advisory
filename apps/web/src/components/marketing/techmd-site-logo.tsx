'use client';

import Image from 'next/image';
import type { ReactElement } from 'react';
import { useMarketingAppearance } from '@/components/marketing/marketing-appearance-provider';

// Intrinsic pixels from `scripts/generate-techmd-brand-assets.py` (2× pipeline on 1024px master).
const LOGO_FULL_WIDTH_PX = 1748;
const LOGO_FULL_HEIGHT_PX = 368;
const LOGO_COMPACT_WIDTH_PX = 1748;
const LOGO_COMPACT_HEIGHT_PX = 368;

/**
 * Responsive TECHMD logo for the marketing header: full wordmark + tagline on large screens,
 * compact wordmark (no tagline) on smaller breakpoints. Uses light-ink variants in dark mode.
 */
export function TechmdSiteLogo(): ReactElement {
  const { isDark } = useMarketingAppearance();
  const srcFull = isDark ? '/brand/techmd-logo-full-dark.png' : '/brand/techmd-logo-full.png';
  const srcCompact = isDark ? '/brand/techmd-logo-compact-dark.png' : '/brand/techmd-logo-compact.png';
  return (
    <span className="relative inline-flex max-h-10 items-center sm:max-h-11">
      <Image
        key={srcFull}
        src={srcFull}
        alt="TECHMD — Technology consultation. Better decisions. Stronger business."
        width={LOGO_FULL_WIDTH_PX}
        height={LOGO_FULL_HEIGHT_PX}
        priority
        sizes="(min-width: 1024px) 400px, 0px"
        className="hidden h-8 w-auto max-h-10 object-contain object-left sm:h-9 lg:block lg:h-10"
      />
      <Image
        key={srcCompact}
        src={srcCompact}
        alt="TECHMD"
        width={LOGO_COMPACT_WIDTH_PX}
        height={LOGO_COMPACT_HEIGHT_PX}
        priority
        sizes="(max-width: 1023px) 300px, 0px"
        className="h-8 w-auto max-h-10 object-contain object-left sm:h-9 lg:hidden"
      />
    </span>
  );
}
