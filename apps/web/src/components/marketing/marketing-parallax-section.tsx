'use client';

import { useCallback, useEffect, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import { MarketingSectionReveal } from '@/components/marketing/marketing-section-reveal';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { subscribeMarketingScrollFrame } from '@/lib/marketing/subscribe-marketing-scroll-frame';
import { useMarketingSectionInView } from '@/lib/marketing/use-marketing-section-in-view';
import { cn } from '@/lib/utils';

const MAX_CONTENT_OFFSET_PX = 52;
const MAX_BACKGROUND_OFFSET_PX = 72;
const SECTION_PARALLAX_Y_PROPERTY = '--section-parallax-y';
const SECTION_PARALLAX_BG_Y_PROPERTY = '--section-parallax-bg-y';

function clampOffset(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

function executeResetSectionParallax(section: HTMLElement): void {
  section.style.setProperty(SECTION_PARALLAX_Y_PROPERTY, '0px');
  section.style.setProperty(SECTION_PARALLAX_BG_Y_PROPERTY, '0px');
}

export type MarketingParallaxSectionProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly id?: string;
  readonly ref?: Ref<HTMLElement>;
  readonly speed?: number;
  readonly background?: ReactNode;
  readonly backgroundSpeed?: number;
  /** In-view stagger reveal. Off when reduced motion is preferred. Default true. */
  readonly reveal?: boolean;
  readonly revealStagger?: boolean;
};

/**
 * Scroll-linked vertical shift for landing sections. Disabled when the user prefers reduced motion.
 * Optional `background` renders behind content with a stronger shift for depth (hero use).
 */
export function MarketingParallaxSection(props: MarketingParallaxSectionProps): ReactElement {
  const {
    children,
    className,
    contentClassName,
    id,
    ref: forwardedRef,
    speed: speedProp,
    background,
    backgroundSpeed: backgroundSpeedProp,
    reveal: revealProp,
    revealStagger: revealStaggerProp,
  } = props;
  const speed = speedProp ?? 0.12;
  const backgroundSpeed = backgroundSpeedProp ?? speed * 1.7;
  const reveal = revealProp ?? true;
  const revealStagger = revealStaggerProp ?? false;
  const hasBackground = background !== undefined;
  const isParallaxEnabled = speed > 0 || (hasBackground && backgroundSpeed > 0);
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const executeAssignSectionRef = useCallback(
    (node: HTMLElement | null): void => {
      setSectionElement(node);
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
        return;
      }
      if (forwardedRef !== undefined && forwardedRef !== null) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  const isRevealEnabled = reveal && !prefersReducedMotion;
  const isInView = useMarketingSectionInView(sectionElement);
  useEffect(() => {
    const section = sectionElement;
    if (section === null) {
      return;
    }
    if (prefersReducedMotion || !isParallaxEnabled) {
      executeResetSectionParallax(section);
      return;
    }
    let lastContentY = '';
    let lastBackgroundY = '';
    const executeUpdate = (): void => {
      if (!isInView) {
        return;
      }
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const sectionCenterY = rect.top + rect.height / 2;
      const viewportCenterY = viewportHeight / 2;
      const delta = viewportCenterY - sectionCenterY;
      const contentOffsetPx = Math.round(clampOffset(delta * speed, MAX_CONTENT_OFFSET_PX));
      const contentY = `${contentOffsetPx}px`;
      if (contentY !== lastContentY) {
        section.style.setProperty(SECTION_PARALLAX_Y_PROPERTY, contentY);
        lastContentY = contentY;
      }
      if (hasBackground) {
        const backgroundOffsetPx = Math.round(clampOffset(delta * backgroundSpeed, MAX_BACKGROUND_OFFSET_PX));
        const backgroundY = `${backgroundOffsetPx}px`;
        if (backgroundY !== lastBackgroundY) {
          section.style.setProperty(SECTION_PARALLAX_BG_Y_PROPERTY, backgroundY);
          lastBackgroundY = backgroundY;
        }
      }
    };
    const unsubscribe = subscribeMarketingScrollFrame(executeUpdate);
    return () => {
      unsubscribe();
      executeResetSectionParallax(section);
    };
  }, [backgroundSpeed, hasBackground, isInView, isParallaxEnabled, prefersReducedMotion, sectionElement, speed]);
  useEffect(() => {
    const section = sectionElement;
    if (section === null || prefersReducedMotion || isInView || !isParallaxEnabled) {
      return;
    }
    executeResetSectionParallax(section);
  }, [isInView, isParallaxEnabled, prefersReducedMotion, sectionElement]);
  const content = isRevealEnabled ? (
    <MarketingSectionReveal className={contentClassName} stagger={revealStagger}>
      {children}
    </MarketingSectionReveal>
  ) : (
    <div className={contentClassName}>{children}</div>
  );
  return (
    <section
      ref={executeAssignSectionRef}
      className={cn(
        'marketing-parallax-section relative',
        isParallaxEnabled && !prefersReducedMotion && 'marketing-parallax-section--active',
        hasBackground && 'isolate',
        className,
      )}
      id={id}
    >
      {hasBackground ? (
        <div
          className="marketing-parallax-section__background pointer-events-none absolute inset-0 z-0 min-h-full overflow-clip"
          aria-hidden
        >
          {background}
        </div>
      ) : null}
      <div className={cn('marketing-parallax-section__content relative z-10 min-w-0', !isRevealEnabled && contentClassName)}>
        {content}
      </div>
    </section>
  );
}
