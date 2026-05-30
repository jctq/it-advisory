import { Suspense, type ReactElement } from 'react';
import { QuizFlow } from './quiz-flow';
import { QuizRouteLoadingFallback } from './quiz-route-loading-fallback';
import { buildPageMetadata } from '@/lib/seo/site-seo';

export async function generateMetadata() {
  return buildPageMetadata('diagnostic', { pathname: '/diagnostic' });
}

export default function QuizPage(): ReactElement {
  return (
    <main>
      <Suspense fallback={<QuizRouteLoadingFallback />}>
        <QuizFlow />
      </Suspense>
    </main>
  );
}
