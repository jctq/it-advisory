'use client';

import { useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useCanUseHeroMouseParallax } from '@/hooks/use-can-use-hero-mouse-parallax';
import { useDocumentVisible } from '@/hooks/use-document-visible';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

const HERO_IDLE_DECAY_MS = 1200;
const HERO_TAP_BOOST_MS = 3500;
const HERO_IN_VIEW_THRESHOLD = 0.12;
const HERO_IDLE_CHECK_MS = 200;
const HERO_PARALLAX_CENTER = 0.5;
/** Global mouse-parallax intensity (0 = off, 1 = default, 1.5 = stronger). Scales all hero layer shifts in globals.css. */
export const HERO_PARALLAX_STRENGTH = 1;
const HERO_SPRING_CONFIG = { stiffness: 52, damping: 32, restDelta: 0.0008, restSpeed: 0.008 };
const HERO_BOOST_SPRING_CONFIG = { stiffness: 120, damping: 34, restDelta: 0.001, restSpeed: 0.01 };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type HeroParallaxSnapshot = {
  readonly fx: number;
  readonly fy: number;
  readonly boost: number;
};

export type MarketingHeroInteractionState = {
  readonly isBoosted: boolean;
  readonly isInView: boolean;
  readonly isDocumentVisible: boolean;
  readonly rootStyle: CSSProperties;
};

export type MarketingHeroInteraction = MarketingHeroInteractionState & {
  readonly sectionRef: (node: HTMLElement | null) => void;
};

/**
 * Page-wide pointer tracking while the hero is in view: mouse parallax on layers + idle decay after last move.
 * Pointer position is preserved across tab blur/focus to avoid spring snap. Disabled when reduced motion is preferred
 * or on mobile / touch-primary devices (no fine hover pointer).
 */
export function useMarketingHeroInteraction(): MarketingHeroInteraction {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canUseMouseParallax = useCanUseHeroMouseParallax();
  const isParallaxEnabled = !prefersReducedMotion && canUseMouseParallax;
  const isDocumentVisible = useDocumentVisible();
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [isBoosted, setIsBoosted] = useState(false);
  const parallaxSnapshotRef = useRef<HeroParallaxSnapshot | null>(null);
  const boostUntilRef = useRef(0);
  const pointerX = useMotionValue(HERO_PARALLAX_CENTER);
  const pointerY = useMotionValue(HERO_PARALLAX_CENTER);
  const boostTarget = useMotionValue(0);
  const springX = useSpring(pointerX, HERO_SPRING_CONFIG);
  const springY = useSpring(pointerY, HERO_SPRING_CONFIG);
  const springBoost = useSpring(boostTarget, HERO_BOOST_SPRING_CONFIG);
  const executeExtendBoost = useCallback((): void => {
    if (!isDocumentVisible) {
      return;
    }
    boostUntilRef.current = Date.now() + HERO_IDLE_DECAY_MS;
    setIsBoosted(true);
    boostTarget.set(1);
  }, [boostTarget, isDocumentVisible]);
  const executeTapBoost = useCallback((): void => {
    boostUntilRef.current = Date.now() + HERO_TAP_BOOST_MS;
    setIsBoosted(true);
    boostTarget.set(1);
  }, [boostTarget]);
  const executeDecayBoost = useCallback((): void => {
    setIsBoosted(false);
    boostTarget.set(0);
  }, [boostTarget]);
  const sectionRef = useCallback((node: HTMLElement | null) => {
    setSectionElement(node);
  }, []);
  const executeUpdatePointer = useCallback(
    (clientX: number, clientY: number): void => {
      if (sectionElement === null || !isDocumentVisible) {
        return;
      }
      const rect = sectionElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      pointerX.set(clamp01((clientX - rect.left) / rect.width));
      pointerY.set(clamp01((clientY - rect.top) / rect.height));
    },
    [pointerX, pointerY, sectionElement, isDocumentVisible],
  );
  const executeResetParallax = useCallback((): void => {
    pointerX.set(HERO_PARALLAX_CENTER);
    pointerY.set(HERO_PARALLAX_CENTER);
    executeDecayBoost();
  }, [pointerX, pointerY, executeDecayBoost]);
  useEffect(() => {
    if (!isParallaxEnabled) {
      queueMicrotask(() => {
        executeResetParallax();
        setIsInView(false);
      });
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
  }, [isParallaxEnabled, sectionElement, executeResetParallax]);
  useEffect(() => {
    if (!isParallaxEnabled || !isInView) {
      queueMicrotask(() => {
        executeResetParallax();
      });
      return;
    }
    const executeOnPointerMove = (event: PointerEvent): void => {
      if (!isDocumentVisible) {
        return;
      }
      executeUpdatePointer(event.clientX, event.clientY);
      executeExtendBoost();
    };
    document.addEventListener('pointermove', executeOnPointerMove, { passive: true });
    const idleTimer = window.setInterval(() => {
      if (!isDocumentVisible) {
        return;
      }
      if (Date.now() > boostUntilRef.current) {
        executeDecayBoost();
      }
    }, HERO_IDLE_CHECK_MS);
    return () => {
      document.removeEventListener('pointermove', executeOnPointerMove);
      window.clearInterval(idleTimer);
    };
  }, [
    isParallaxEnabled,
    isInView,
    isDocumentVisible,
    executeExtendBoost,
    executeUpdatePointer,
    executeDecayBoost,
    executeResetParallax,
  ]);
  useLayoutEffect(() => {
    if (isDocumentVisible) {
      parallaxSnapshotRef.current = null;
      return;
    }
    parallaxSnapshotRef.current = {
      fx: springX.get(),
      fy: springY.get(),
      boost: springBoost.get(),
    };
  }, [isDocumentVisible, springBoost, springX, springY]);
  useEffect(() => {
    if (!isParallaxEnabled) {
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
  }, [isParallaxEnabled, executeTapBoost, executeUpdatePointer, sectionElement]);
  const rootStyle = {
    '--hero-parallax-strength': isParallaxEnabled ? HERO_PARALLAX_STRENGTH : 0,
  } as CSSProperties;
  useEffect(() => {
    const section = sectionElement;
    if (section === null) {
      return;
    }
    const strength = isParallaxEnabled ? String(HERO_PARALLAX_STRENGTH) : '0';
    section.style.setProperty('--hero-parallax-strength', strength);
    if (!isParallaxEnabled) {
      section.style.setProperty('--hero-fx', String(HERO_PARALLAX_CENTER));
      section.style.setProperty('--hero-fy', String(HERO_PARALLAX_CENTER));
      section.style.setProperty('--hero-boost', '0');
      return;
    }
    const snapshot = isDocumentVisible ? null : parallaxSnapshotRef.current;
    if (snapshot !== null) {
      section.style.setProperty('--hero-fx', String(snapshot.fx));
      section.style.setProperty('--hero-fy', String(snapshot.fy));
      section.style.setProperty('--hero-boost', String(snapshot.boost));
      return;
    }
    section.style.setProperty('--hero-fx', String(springX.get()));
    section.style.setProperty('--hero-fy', String(springY.get()));
    section.style.setProperty('--hero-boost', String(springBoost.get()));
  }, [isDocumentVisible, isParallaxEnabled, sectionElement, springBoost, springX, springY]);
  useMotionValueEvent(springX, 'change', (latest) => {
    if (!isParallaxEnabled || sectionElement === null || !isDocumentVisible) {
      return;
    }
    sectionElement.style.setProperty('--hero-fx', String(latest));
  });
  useMotionValueEvent(springY, 'change', (latest) => {
    if (!isParallaxEnabled || sectionElement === null || !isDocumentVisible) {
      return;
    }
    sectionElement.style.setProperty('--hero-fy', String(latest));
  });
  useMotionValueEvent(springBoost, 'change', (latest) => {
    if (!isParallaxEnabled || sectionElement === null || !isDocumentVisible) {
      return;
    }
    sectionElement.style.setProperty('--hero-boost', String(latest));
  });
  return { isBoosted, isInView, isDocumentVisible, rootStyle, sectionRef };
}
