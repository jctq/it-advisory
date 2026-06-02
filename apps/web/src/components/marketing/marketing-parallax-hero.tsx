'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { MarketingHeroImageBackdrop } from '@/components/marketing/marketing-hero-image-backdrop';
import { useMarketingHeroInteraction } from '@/components/marketing/use-marketing-hero-interaction';
import { useMarketingHeroScrollParallax } from '@/components/marketing/use-marketing-hero-scroll-parallax';
import { cn } from '@/lib/utils';

export type MarketingParallaxHeroProps = {
  readonly children: ReactNode;
  readonly scrollCueHref?: string;
  readonly footerNote?: ReactNode;
  readonly className?: string;
};

/**
 * Full-viewport photo hero with scroll parallax, gradient scrims, and SVG art overlay.
 */
export function MarketingParallaxHero(props: MarketingParallaxHeroProps): ReactElement {
  const { children, scrollCueHref = '#proof', footerNote, className } = props;
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const { sectionRef: heroInteractionRef, isBoosted, isInView, isDocumentVisible, rootStyle } =
    useMarketingHeroInteraction();
  useMarketingHeroScrollParallax(sectionElement);
  const executeAssignSectionRef = useCallback(
    (node: HTMLElement | null): void => {
      setSectionElement(node);
      heroInteractionRef(node);
    },
    [heroInteractionRef],
  );
  return (
    <section
      ref={executeAssignSectionRef}
      className={cn(
        'marketing-parallax-hero marketing-parallax-hero--image marketing-parallax-hero--layout-centered relative isolate -mt-[4.5rem] flex min-h-dvh flex-col overflow-clip px-5 sm:-mt-20 sm:px-6',
        className,
      )}
      style={rootStyle}
    >
      <div className="marketing-parallax-hero-backdrop pointer-events-none absolute inset-0 z-0 size-full min-h-full" aria-hidden>
        <MarketingHeroImageBackdrop
          interaction={{ isBoosted, isInView, isDocumentVisible, rootStyle }}
        />
      </div>
      <div className="marketing-parallax-hero-content relative z-10 mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col justify-end pb-10 pt-24 sm:pb-20 sm:pt-20">
        {children}
        {(footerNote !== undefined || scrollCueHref.length > 0) && (
          <div className="mt-8 flex w-full flex-col gap-5 sm:mt-12 sm:flex-row sm:items-end sm:justify-between sm:gap-6 md:mt-14">
            {footerNote !== undefined ? (
              <div className="marketing-hero-footer-note max-w-2xl text-sm md:pb-1">{footerNote}</div>
            ) : (
              <span className="min-w-0 flex-1" aria-hidden />
            )}
            <a
              href={scrollCueHref}
              className="marketing-scroll-cue hidden shrink-0 motion-safe:hover:text-foreground sm:ms-auto sm:inline-flex"
            >
              <span className="sr-only">Scroll to learn more</span>
              <span className="text-center" aria-hidden>
                Scroll
              </span>
              <span className="flex flex-col items-center" aria-hidden>
                <span className="marketing-scroll-cue-line" />
                <ChevronDown className="size-4 opacity-70" />
              </span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
