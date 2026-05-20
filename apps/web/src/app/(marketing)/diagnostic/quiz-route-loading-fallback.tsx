import type { ReactElement } from 'react';

/**
 * Shared Suspense fallback for marketing diagnostic routes (`/diagnostic`, `/diagnostic/[sessionRef]`).
 */
export function QuizRouteLoadingFallback(): ReactElement {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="h-2 animate-pulse rounded-full bg-muted" aria-hidden />
      <div className="mt-10 h-8 max-w-md animate-pulse rounded-md bg-muted" aria-hidden />
      <div className="mt-4 h-4 max-w-lg animate-pulse rounded-md bg-muted/70" aria-hidden />
      <p className="sr-only">Loading your diagnostic progress</p>
    </div>
  );
}
