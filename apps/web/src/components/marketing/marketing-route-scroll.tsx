'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect } from 'react';

function scrollWindowToTop(): void {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

/**
 * Resets window scroll when the marketing pathname changes.
 * Shared marketing layout soft navigations (e.g. blog index ↔ article) do not always
 * return to the top; document-level smooth scrolling can also delay programmatic reset.
 */
export function MarketingRouteScroll(): null {
  const pathname = usePathname();
  useLayoutEffect(() => {
    scrollWindowToTop();
  }, [pathname]);
  return null;
}
