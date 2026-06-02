'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactElement } from 'react';
import { MarketingNewDiagnosticCtaLabel } from '@/components/marketing/marketing-new-diagnostic-cta-label';
import { Button } from '@/components/ui/button';

export type MarketingParallaxHeroBodyProps = {
  readonly isNavigating: boolean;
  readonly onStartDiagnostic: () => void;
};

/**
 * Homepage hero copy block.
 */
export function MarketingParallaxHeroBody(props: MarketingParallaxHeroBodyProps): ReactElement {
  const { isNavigating, onStartDiagnostic } = props;
  return (
    <div className="marketing-parallax-hero-body marketing-parallax-hero-body--on-image max-w-2xl min-w-0 space-y-0">
      <h1 className="text-balance text-[1.875rem] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-4xl sm:leading-[1.1] sm:tracking-[-0.04em] md:text-6xl md:leading-[1.04] lg:text-[3.75rem] lg:leading-[1.02]">
        Every technology problem has a root cause.
      </h1>
      <p className="marketing-hero-lead mt-4 text-pretty text-lg font-medium leading-snug sm:mt-6 sm:text-xl md:text-2xl md:leading-snug">
        Identify the challenges affecting your systems, processes, and software investments before they become costly
        problems.
      </p>
      <p className="marketing-hero-support mt-3 text-pretty text-[0.9375rem] leading-relaxed sm:mt-4 sm:text-base">
        A guided assessment, tailored recommendations, and expert consultation — designed to help you make smarter
        technology decisions.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="lg"
          className="marketing-hero-cta group inline-flex h-12 w-full min-h-12 items-center justify-center gap-2 bg-transparent px-6 active:translate-y-0 hover:bg-transparent sm:h-11 sm:w-auto sm:min-h-11 sm:justify-start dark:bg-primary dark:hover:bg-primary/90"
          disabled={isNavigating}
          onClick={onStartDiagnostic}
        >
          <MarketingNewDiagnosticCtaLabel isNavigating={isNavigating} />
          <ArrowRight
            className="size-4 shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            aria-hidden
          />
        </Button>
      </div>
    </div>
  );
}
