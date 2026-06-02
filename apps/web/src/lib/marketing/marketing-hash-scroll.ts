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
