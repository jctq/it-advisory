import { useEffect, useState } from 'react';

const SECTION_IN_VIEW_ROOT_MARGIN = '50% 0px';

/**
 * Tracks whether an element intersects the viewport (with margin) for pausing scroll-linked work off-screen.
 */
export function useMarketingSectionInView(element: HTMLElement | null): boolean {
  const [isInView, setIsInView] = useState(true);
  useEffect(() => {
    if (element === null) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry?.isIntersecting ?? false);
      },
      { rootMargin: SECTION_IN_VIEW_ROOT_MARGIN },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element]);
  return isInView;
}
