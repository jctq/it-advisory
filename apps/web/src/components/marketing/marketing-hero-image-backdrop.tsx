'use client';

import Image from 'next/image';
import type { ReactElement } from 'react';
import { MarketingHeroBackground } from '@/components/marketing/marketing-hero-background';
import { MARKETING_PARALLAX_HERO } from '@/components/marketing/marketing-parallax-hero-config';
import type { MarketingHeroInteractionState } from '@/components/marketing/use-marketing-hero-interaction';
import { marketingHeroImageUrl } from '@/lib/marketing/marketing-hero-image-url';
import { cn } from '@/lib/utils';

export type MarketingHeroImageBackdropProps = {
  readonly interaction: MarketingHeroInteractionState;
};

/**
 * Hero backdrop: topology SVG art layered over the team collaboration photo.
 */
export function MarketingHeroImageBackdrop(props: MarketingHeroImageBackdropProps): ReactElement {
  const { interaction } = props;
  const photoSrc = marketingHeroImageUrl(MARKETING_PARALLAX_HERO.imageSrc);
  return (
    <div
      className={cn(
        'marketing-hero-image-backdrop absolute inset-0 size-full',
        `marketing-hero-image-backdrop--${MARKETING_PARALLAX_HERO.overlay}`,
        `marketing-hero-image-backdrop--layout-${MARKETING_PARALLAX_HERO.layout}`,
      )}
    >
      <div className="marketing-hero-image-parallax-shift absolute inset-0 size-full">
        <div className="marketing-hero-image-layer marketing-hero-image-layer-base absolute -inset-[8%]">
          <Image
            key={photoSrc}
            src={photoSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="marketing-hero-photo object-cover"
            style={{ objectPosition: MARKETING_PARALLAX_HERO.objectPosition }}
          />
        </div>
      </div>
      <div className="marketing-hero-image-scrim marketing-hero-image-layer absolute inset-0 size-full" aria-hidden />
      <div className="marketing-hero-image-scrim-top marketing-hero-image-layer absolute inset-x-0 top-0 h-[32%]" aria-hidden />
      <div className="marketing-hero-image-scrim-bottom marketing-hero-image-layer absolute inset-x-0 bottom-0 h-[42%]" aria-hidden />
      <div className="marketing-hero-image-art-layer marketing-hero-image-layer absolute inset-0 size-full opacity-[0.55] mix-blend-screen dark:opacity-50 dark:mix-blend-normal">
        <MarketingHeroBackground interaction={interaction} />
      </div>
      <span className="sr-only">{MARKETING_PARALLAX_HERO.imageAlt}</span>
    </div>
  );
}
