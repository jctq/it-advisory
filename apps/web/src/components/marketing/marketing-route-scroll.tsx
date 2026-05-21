'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';

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

function scrollToHashTarget(hash: string): boolean {
  if (!hash || hash === '#') {
    return false;
  }
  const id = decodeURIComponent(hash.slice(1));
  const target = document.getElementById(id);
  if (!target) {
    return false;
  }
  target.scrollIntoView({ behavior: 'auto', block: 'start' });
  return true;
}

function scheduleHashScroll(hash: string): () => void {
  let attempts = 0;
  let frameId = 0;
  const run = (): void => {
    if (scrollToHashTarget(hash)) {
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

function applyRouteScroll(hash: string): () => void {
  if (hash && hash !== '#') {
    return scheduleHashScroll(hash);
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
  const [hash, setHash] = useState(readLocationHash);
  useEffect(() => {
    const syncHash = (): void => {
      setHash(readLocationHash());
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
    };
  }, [pathname]);
  useLayoutEffect(() => {
    return applyRouteScroll(readLocationHash());
  }, [pathname, hash]);
  return null;
}
