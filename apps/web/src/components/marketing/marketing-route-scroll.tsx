'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { resolveMarketingHashScrollBehavior, scrollToMarketingHash } from '@/lib/marketing/marketing-hash-scroll';

const HASH_SCROLL_MAX_ATTEMPTS = 24;

function scrollWindowToTop(): void {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

function readLocationHash(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.hash;
}

function scheduleHashScroll(hash: string, prefersReducedMotion: boolean): () => void {
  const behavior = resolveMarketingHashScrollBehavior(prefersReducedMotion);
  let attempts = 0;
  let frameId = 0;
  const run = (): void => {
    if (scrollToMarketingHash(hash, behavior)) {
      return;
    }
    attempts += 1;
    if (attempts >= HASH_SCROLL_MAX_ATTEMPTS) {
      return;
    }
    frameId = requestAnimationFrame(run);
  };
  frameId = requestAnimationFrame(run);
  return () => {
    cancelAnimationFrame(frameId);
  };
}

function applyRouteScroll(hash: string, prefersReducedMotion: boolean): () => void {
  if (hash && hash !== '#') {
    return scheduleHashScroll(hash, prefersReducedMotion);
  }
  scrollWindowToTop();
  return () => {};
}

/**
 * Resets window scroll when the marketing pathname changes, or scrolls to a hash target when present.
 * Shared marketing layout soft navigations (e.g. blog ↔ home with `/#section`) do not scroll to anchors
 * on their own; scrolling to top here previously overwrote cross-route hash links.
 */
export function MarketingRouteScroll(): null {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hash, setHash] = useState(readLocationHash);
  useEffect(() => {
    const syncHash = (): void => {
      setHash(readLocationHash());
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('popstate', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('popstate', syncHash);
    };
  }, [pathname]);
  useLayoutEffect(() => {
    return applyRouteScroll(readLocationHash(), prefersReducedMotion);
  }, [pathname, hash, prefersReducedMotion]);
  return null;
}
