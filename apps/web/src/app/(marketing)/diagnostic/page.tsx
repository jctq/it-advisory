import { Suspense, type ReactElement } from 'react';
import { DiagnosticFlow } from './diagnostic-flow';
import { DiagnosticRouteLoadingFallback } from './diagnostic-route-loading-fallback';
import { buildPageMetadata } from '@/lib/seo/site-seo';

export async function generateMetadata() {
  return buildPageMetadata('diagnostic', { pathname: '/diagnostic' });
}

export default function DiagnosticPage(): ReactElement {
  return (
    <main>
      <Suspense fallback={<DiagnosticRouteLoadingFallback />}>
        <DiagnosticFlow />
      </Suspense>
    </main>
  );
}
