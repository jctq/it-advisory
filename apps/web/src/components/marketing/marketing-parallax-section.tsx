'use client';

import { useEffect, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import { MarketingSectionReveal } from '@/components/marketing/marketing-section-reveal';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

const MAX_CONTENT_OFFSET_PX = 52;
const MAX_BACKGROUND_OFFSET_PX = 72;

function mergeRefs<T>(...refs: readonly (Ref<T> | undefined)[]): (node: T | null) => void {
  return (node: T | null): void => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(node);
        return;
      }
      if (ref !== undefined && ref !== null) {
        ref.current = node;
      }
    });
  };
}

function clampOffset(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
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
  const internalSectionRef = useRef<HTMLElement>(null);
  const sectionRef = mergeRefs(forwardedRef, internalSectionRef);
  const [contentOffset, setContentOffset] = useState(0);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isRevealEnabled = reveal && !prefersReducedMotion;
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    const section = internalSectionRef.current;
    if (section === null) {
      return;
    }
    let raf = 0;
    const executeUpdate = (): void => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const sectionCenterY = rect.top + rect.height / 2;
      const viewportCenterY = viewportHeight / 2;
      const delta = viewportCenterY - sectionCenterY;
      setContentOffset(clampOffset(delta * speed, MAX_CONTENT_OFFSET_PX));
      if (hasBackground) {
        setBackgroundOffset(clampOffset(delta * backgroundSpeed, MAX_BACKGROUND_OFFSET_PX));
      }
    };
    const executeRequestFrame = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(executeUpdate);
    };
    executeUpdate();
    window.addEventListener('scroll', executeRequestFrame, { passive: true });
    window.addEventListener('resize', executeRequestFrame, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', executeRequestFrame);
      window.removeEventListener('resize', executeRequestFrame);
    };
  }, [prefersReducedMotion, speed, backgroundSpeed, hasBackground]);
  const contentTransform =
    prefersReducedMotion || contentOffset === 0 ? undefined : `translate3d(0, ${contentOffset}px, 0)`;
  const backgroundTransform =
    prefersReducedMotion || !hasBackground || backgroundOffset === 0
      ? undefined
      : `translate3d(0, ${backgroundOffset}px, 0)`;
  const content = isRevealEnabled ? (
    <MarketingSectionReveal className={contentClassName} stagger={revealStagger}>
      {children}
    </MarketingSectionReveal>
  ) : (
    <div className={contentClassName}>{children}</div>
  );
  return (
    <section
      ref={sectionRef as Ref<HTMLElement>}
      className={cn('relative', hasBackground && 'isolate', className)}
      id={id}
    >
      {hasBackground ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 min-h-full overflow-hidden"
          style={{
            transform: backgroundTransform,
            willChange: backgroundTransform === undefined ? undefined : 'transform',
          }}
          aria-hidden
        >
          {background}
        </div>
      ) : null}
      <div
        className={cn('relative z-10 min-w-0', !isRevealEnabled && contentClassName)}
        style={{
          transform: contentTransform,
          willChange: contentTransform === undefined ? undefined : 'transform',
        }}
      >
        {content}
      </div>
    </section>
  );
}
