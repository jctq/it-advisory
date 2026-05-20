'use client';

import { useMotionValue, useSpring } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

const HERO_IDLE_DECAY_MS = 1200;
const HERO_TAP_BOOST_MS = 3500;
const HERO_IN_VIEW_THRESHOLD = 0.12;
const HERO_IDLE_CHECK_MS = 200;
const HERO_PARALLAX_CENTER = 0.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export type MarketingHeroInteraction = {
  readonly isBoosted: boolean;
  readonly isInView: boolean;
  readonly rootStyle: CSSProperties;
  readonly sectionRef: (node: HTMLElement | null) => void;
};

/**
 * Page-wide pointer tracking while the hero is in view: mouse parallax on layers + idle decay after last move.
 * Tap on the hero extends parallax on touch devices. Disabled when reduced motion is preferred.
 */
export function useMarketingHeroInteraction(): MarketingHeroInteraction {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [isBoosted, setIsBoosted] = useState(false);
  const boostUntilRef = useRef(0);
  const pointerX = useMotionValue(HERO_PARALLAX_CENTER);
  const pointerY = useMotionValue(HERO_PARALLAX_CENTER);
  const boostTarget = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 72, damping: 22 });
  const springY = useSpring(pointerY, { stiffness: 72, damping: 22 });
  const springBoost = useSpring(boostTarget, { stiffness: 140, damping: 26 });
  const executeExtendBoost = useCallback((): void => {
    boostUntilRef.current = Date.now() + HERO_IDLE_DECAY_MS;
    setIsBoosted(true);
    boostTarget.set(1);
  }, [boostTarget]);
  const executeTapBoost = useCallback((): void => {
    boostUntilRef.current = Date.now() + HERO_TAP_BOOST_MS;
    setIsBoosted(true);
    boostTarget.set(1);
  }, [boostTarget]);
  const sectionRef = useCallback((node: HTMLElement | null) => {
    setSectionElement(node);
  }, []);
  const executeUpdatePointer = useCallback(
    (clientX: number, clientY: number): void => {
      if (sectionElement === null) {
        return;
      }
      const rect = sectionElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      pointerX.set(clamp01((clientX - rect.left) / rect.width));
      pointerY.set(clamp01((clientY - rect.top) / rect.height));
    },
    [pointerX, pointerY, sectionElement],
  );
  const executeResetPointer = useCallback((): void => {
    pointerX.set(HERO_PARALLAX_CENTER);
    pointerY.set(HERO_PARALLAX_CENTER);
  }, [pointerX, pointerY]);
  useEffect(() => {
    if (prefersReducedMotion) {
      setIsBoosted(false);
      setIsInView(false);
      boostTarget.set(0);
      executeResetPointer();
      return;
    }
    if (sectionElement === null) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry?.isIntersecting ?? false);
      },
      { threshold: HERO_IN_VIEW_THRESHOLD },
    );
    observer.observe(sectionElement);
    return () => {
      observer.disconnect();
    };
  }, [prefersReducedMotion, boostTarget, sectionElement, executeResetPointer]);
  useEffect(() => {
    if (prefersReducedMotion || !isInView) {
      setIsBoosted(false);
      boostTarget.set(0);
      executeResetPointer();
      return;
    }
    const executeOnPointerMove = (event: PointerEvent): void => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      executeUpdatePointer(event.clientX, event.clientY);
      executeExtendBoost();
    };
    const executeOnVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        setIsBoosted(false);
        boostTarget.set(0);
        executeResetPointer();
      }
    };
    document.addEventListener('pointermove', executeOnPointerMove, { passive: true });
    document.addEventListener('visibilitychange', executeOnVisibilityChange);
    const idleTimer = window.setInterval(() => {
      if (Date.now() > boostUntilRef.current) {
        setIsBoosted(false);
        boostTarget.set(0);
        executeResetPointer();
      }
    }, HERO_IDLE_CHECK_MS);
    return () => {
      document.removeEventListener('pointermove', executeOnPointerMove);
      document.removeEventListener('visibilitychange', executeOnVisibilityChange);
      window.clearInterval(idleTimer);
    };
  }, [
    prefersReducedMotion,
    isInView,
    executeExtendBoost,
    executeUpdatePointer,
    executeResetPointer,
    boostTarget,
  ]);
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    if (sectionElement === null) {
      return;
    }
    const executeOnTap = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('button, a, input, textarea, select, [role="button"]')
      ) {
        return;
      }
      executeUpdatePointer(event.clientX, event.clientY);
      executeTapBoost();
    };
    sectionElement.addEventListener('pointerdown', executeOnTap, { passive: true });
    return () => {
      sectionElement.removeEventListener('pointerdown', executeOnTap);
    };
  }, [prefersReducedMotion, executeTapBoost, executeUpdatePointer, sectionElement]);
  const rootStyle = {
    '--hero-fx': springX,
    '--hero-fy': springY,
    '--hero-boost': springBoost,
  } as CSSProperties;
  return { isBoosted, isInView, rootStyle, sectionRef };
}
