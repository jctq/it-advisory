'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const MAX_CONTENT_OFFSET_PX = 52;
const MAX_BACKGROUND_OFFSET_PX = 72;

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  mediaQuery.addEventListener('change', executeHandleChange);
  return () => {
    mediaQuery.removeEventListener('change', executeHandleChange);
  };
}

function resolveClientReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resolveServerReducedMotion(): boolean {
  return true;
}

function clampOffset(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

export type MarketingParallaxSectionProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly id?: string;
  readonly speed?: number;
  readonly background?: ReactNode;
  readonly backgroundSpeed?: number;
};

/**
 * Scroll-linked vertical shift for landing sections. Disabled when the user prefers reduced motion.
 * Optional `background` renders behind content with a stronger shift for depth (hero use).
 */
export function MarketingParallaxSection(props: MarketingParallaxSectionProps): ReactElement {
  const speed = props.speed ?? 0.12;
  const backgroundSpeed = props.backgroundSpeed ?? speed * 1.7;
  const hasBackground = props.background !== undefined;
  const sectionRef = useRef<HTMLElement>(null);
  const [contentOffset, setContentOffset] = useState(0);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    resolveClientReducedMotion,
    resolveServerReducedMotion,
  );
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    const section = sectionRef.current;
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
  return (
    <section
      ref={sectionRef}
      className={cn('relative', hasBackground && 'isolate', props.className)}
      id={props.id}
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
          {props.background}
        </div>
      ) : null}
      <div
        className={cn('relative z-10', props.contentClassName)}
        style={{
          transform: contentTransform,
          willChange: contentTransform === undefined ? undefined : 'transform',
        }}
      >
        {props.children}
      </div>
    </section>
  );
}
