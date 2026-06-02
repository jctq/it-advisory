'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';

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
  const executeClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>): void => {
      if (pathname !== '/') {
        return;
      }
      event.preventDefault();
      if (window.location.hash.length > 0) {
        router.replace('/');
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    },
    [pathname, router],
  );
  return (
    <Link href="/" className={props.className} onClick={executeClick}>
      {props.children}
    </Link>
  );
}
