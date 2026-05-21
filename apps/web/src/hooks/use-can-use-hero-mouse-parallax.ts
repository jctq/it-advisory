'use client';

import { useSyncExternalStore } from 'react';

/** Matches Tailwind `md` — parallax is off below this width. */
const HERO_MOUSE_PARALLAX_MIN_WIDTH_PX = 768;

const HERO_MOUSE_PARALLAX_MEDIA_QUERY = `(hover: hover) and (pointer: fine) and (min-width: ${HERO_MOUSE_PARALLAX_MIN_WIDTH_PX}px)`;

function subscribeHeroMouseParallax(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(HERO_MOUSE_PARALLAX_MEDIA_QUERY);
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  mediaQuery.addEventListener('change', executeHandleChange);
  return () => {
    mediaQuery.removeEventListener('change', executeHandleChange);
  };
}

function resolveClientHeroMouseParallax(): boolean {
  return window.matchMedia(HERO_MOUSE_PARALLAX_MEDIA_QUERY).matches;
}

function resolveServerHeroMouseParallax(): boolean {
  return false;
}

/** True on desktop viewports with a fine pointer and hover (mouse/trackpad). SSR-safe. */
export function useCanUseHeroMouseParallax(): boolean {
  return useSyncExternalStore(
    subscribeHeroMouseParallax,
    resolveClientHeroMouseParallax,
    resolveServerHeroMouseParallax,
  );
}
