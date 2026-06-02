'use client';

import { useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  isSameDocumentMarketingHashLink,
  readHashFromAnchor,
  resolveMarketingHashScrollBehavior,
  scrollToMarketingHash,
  writeMarketingLocationHash,
} from '@/lib/marketing/marketing-hash-scroll';

/**
 * Smooth scroll for in-page / home hash links (e.g. `/#services` in the header).
 * Avoids `scroll-behavior: smooth` on `html`, which makes wheel / trackpad scrolling feel heavy.
 */
export function MarketingSmoothScroll(): null {
  const prefersReducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const executeOnAnchorClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest('a[href*="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (!isSameDocumentMarketingHashLink(anchor)) {
        return;
      }
      const hash = readHashFromAnchor(anchor);
      if (hash === null) {
        return;
      }
      const sectionId = decodeURIComponent(hash.slice(1));
      if (document.getElementById(sectionId) === null) {
        return;
      }
      event.preventDefault();
      scrollToMarketingHash(hash, resolveMarketingHashScrollBehavior(prefersReducedMotion));
      writeMarketingLocationHash(hash);
    };
    document.addEventListener('click', executeOnAnchorClick);
    return () => {
      document.removeEventListener('click', executeOnAnchorClick);
    };
  }, [prefersReducedMotion]);
  return null;
}
