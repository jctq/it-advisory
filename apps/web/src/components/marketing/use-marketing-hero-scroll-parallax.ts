'use client';

import { useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

const HERO_SCROLL_DELTA_PROPERTY = '--hero-scroll-delta';
const HERO_SCROLL_PROGRESS_PROPERTY = '--hero-scroll-progress';

function executeResetScrollProperties(section: HTMLElement): void {
  section.style.setProperty(HERO_SCROLL_DELTA_PROPERTY, '0px');
  section.style.setProperty(HERO_SCROLL_PROGRESS_PROPERTY, '0');
}

/**
 * Scroll-linked CSS variables for Webflow-style layer parallax through the hero viewport.
 * Writes directly to the section element to avoid React re-renders on every scroll frame.
 * `--hero-scroll-delta` is ≤0 while the hero scrolls (0 at rest below the header) so layers do not shift down and expose gaps.
 */
export function useMarketingHeroScrollParallax(sectionElement: HTMLElement | null): void {
  const prefersReducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const section = sectionElement;
    if (section === null) {
      return;
    }
    if (prefersReducedMotion) {
      executeResetScrollProperties(section);
      return;
    }
    let raf = 0;
    let lastDelta = '';
    let lastProgress = -1;
    const executeUpdate = (): void => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollRange = viewportHeight + rect.height;
      const scrolled = viewportHeight - rect.top;
      const progress = scrollRange > 0 ? Math.max(0, Math.min(1, scrolled / scrollRange)) : 0;
      const parallaxDeltaPx = Math.min(0, rect.top);
      const deltaValue = `${parallaxDeltaPx}px`;
      if (deltaValue !== lastDelta) {
        section.style.setProperty(HERO_SCROLL_DELTA_PROPERTY, deltaValue);
        lastDelta = deltaValue;
      }
      if (progress !== lastProgress) {
        section.style.setProperty(HERO_SCROLL_PROGRESS_PROPERTY, String(progress));
        lastProgress = progress;
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
      executeResetScrollProperties(section);
    };
  }, [prefersReducedMotion, sectionElement]);
}
