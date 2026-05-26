'use client';

import { useEffect, useState } from 'react';

type UseElementIntersectionOptions = {
  readonly rootMargin?: string;
  readonly threshold?: number | number[];
};

/**
 * Tracks whether `element` intersects the viewport (or observer root).
 */
export function useElementIntersection(
  element: HTMLElement | null,
  options: UseElementIntersectionOptions = {},
): boolean {
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);
  useEffect(() => {
    if (element === null) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry?.isIntersecting ?? false);
      },
      {
        root: null,
        rootMargin: options.rootMargin ?? '0px',
        threshold: options.threshold ?? 0,
      },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element, options.rootMargin, options.threshold]);
  return isIntersecting;
}
