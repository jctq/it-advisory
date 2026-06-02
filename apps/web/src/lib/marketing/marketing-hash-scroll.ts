export type MarketingHashScrollBehavior = 'auto' | 'smooth';

export function resolveMarketingHashScrollBehavior(prefersReducedMotion: boolean): MarketingHashScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth';
}

export function readHashFromAnchor(anchor: HTMLAnchorElement): string | null {
  const url = new URL(anchor.href, window.location.href);
  if (!url.hash || url.hash === '#') {
    return null;
  }
  return url.hash;
}

/**
 * True when the anchor targets a section on the current document (e.g. `/#services` on `/`).
 */
export function isSameDocumentMarketingHashLink(anchor: HTMLAnchorElement): boolean {
  const url = new URL(anchor.href, window.location.href);
  if (!url.hash || url.hash === '#') {
    return false;
  }
  return url.pathname === window.location.pathname && url.search === window.location.search;
}

export function scrollToMarketingTop(behavior: MarketingHashScrollBehavior): void {
  window.scrollTo({ top: 0, left: 0, behavior });
}

export function scrollToMarketingHash(hash: string, behavior: MarketingHashScrollBehavior): boolean {
  if (!hash || hash === '#') {
    return false;
  }
  const sectionId = decodeURIComponent(hash.slice(1));
  const target = document.getElementById(sectionId);
  if (target === null) {
    return false;
  }
  target.scrollIntoView({ behavior, block: 'start' });
  return true;
}

/**
 * Updates the address bar hash after programmatic same-document navigation.
 * `pushState` does not fire `hashchange`; dispatch it so `MarketingRouteScroll` stays in sync.
 */
export function writeMarketingLocationHash(hash: string): void {
  if (!hash || hash === '#') {
    return;
  }
  const currentUrl = new URL(window.location.href);
  const nextPath = `${currentUrl.pathname}${currentUrl.search}${hash}`;
  const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  if (nextPath === currentPath) {
    return;
  }
  history.pushState(window.history.state, '', nextPath);
  window.dispatchEvent(new Event('hashchange'));
}
