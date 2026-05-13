import type { ReactNode } from 'react';

/**
 * Shared Suspense fallback for marketing book routes (`/book`, `/book/[sessionRef]`).
 */
export function BookRouteLoadingFallback(): ReactNode {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="h-8 max-w-sm animate-pulse rounded-md bg-muted" aria-hidden />
      <div className="mt-4 h-4 max-w-lg animate-pulse rounded-md bg-muted/70" aria-hidden />
      <p className="sr-only">Loading booking calendar</p>
    </div>
  );
}
