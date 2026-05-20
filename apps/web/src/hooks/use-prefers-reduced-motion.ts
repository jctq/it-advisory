'use client';

import { useSyncExternalStore } from 'react';

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  mediaQuery.addEventListener('change', executeHandleChange);
  return () => {
    mediaQuery.removeEventListener('change', executeHandleChange);
  };
}

function resolveClientReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function resolveServerReducedMotion(): boolean {
  return true;
}

/** True when the user has requested reduced motion (SSR-safe). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    resolveClientReducedMotion,
    resolveServerReducedMotion,
  );
}
