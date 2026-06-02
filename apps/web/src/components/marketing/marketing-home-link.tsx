'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  resolveMarketingHashScrollBehavior,
  scrollToMarketingTop,
} from '@/lib/marketing/marketing-hash-scroll';

export type MarketingHomeLinkProps = {
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * Home link that clears in-page hash anchors when already on `/`.
 * Next.js treats `href="/"` as a no-op on the same pathname, so the hash can persist
 * or an older history entry can be restored in production.
 */
export function MarketingHomeLink(props: MarketingHomeLinkProps): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const executeClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>): void => {
      if (pathname !== '/') {
        return;
      }
      event.preventDefault();
      const scrollBehavior = resolveMarketingHashScrollBehavior(prefersReducedMotion);
      if (window.location.hash.length > 0) {
        const pathWithoutHash = `${window.location.pathname}${window.location.search}`;
        history.replaceState(window.history.state, '', pathWithoutHash);
        window.dispatchEvent(new Event('hashchange'));
        router.replace('/');
      } else {
        scrollToMarketingTop(scrollBehavior);
      }
    },
    [pathname, prefersReducedMotion, router],
  );
  return (
    <Link href="/" className={props.className} onClick={executeClick}>
      {props.children}
    </Link>
  );
}
