'use client';

import { useSyncExternalStore } from 'react';

/** Matches Tailwind `md` — mobile layouts use viewport width below this breakpoint. */
export const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 767px)';

function subscribeMobileViewport(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  mediaQuery.addEventListener('change', executeHandleChange);
  return () => {
    mediaQuery.removeEventListener('change', executeHandleChange);
  };
}

function resolveClientMobileViewport(): boolean {
  return window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches;
}

function resolveServerMobileViewport(): boolean {
  return false;
}

/** True below the `md` breakpoint. SSR-safe via `useSyncExternalStore`. */
export function useMobileViewport(): boolean {
  return useSyncExternalStore(
    subscribeMobileViewport,
    resolveClientMobileViewport,
    resolveServerMobileViewport,
  );
}
