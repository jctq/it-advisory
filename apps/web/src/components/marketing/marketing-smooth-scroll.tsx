'use client';

import { useEffect } from 'react';

const MARKETING_SMOOTH_SCROLL_CLASS = 'marketing-smooth-scroll';

/**
 * Applies document-level smooth scrolling for hash / in-page navigation while marketing chrome is active.
 */
export function MarketingSmoothScroll(): null {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(MARKETING_SMOOTH_SCROLL_CLASS);
    return () => {
      root.classList.remove(MARKETING_SMOOTH_SCROLL_CLASS);
    };
  }, []);
  return null;
}
