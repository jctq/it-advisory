import { Suspense, type ReactElement } from 'react';
import { QuizFlow } from './quiz-flow';
import { QuizRouteLoadingFallback } from './quiz-route-loading-fallback';
import { buildMarketingMetadata } from '@/lib/seo/site-seo';

export const metadata = buildMarketingMetadata({
  title: 'Guided diagnostic · TechMD',
  description:
    'Describe your situation, answer short guided intake questions, then finish the diagnostic for a tailored recommendation.',
  pathname: '/diagnostic',
});

export default function QuizPage(): ReactElement {
  return (
    <main>
      <Suspense fallback={<QuizRouteLoadingFallback />}>
        <QuizFlow />
      </Suspense>
    </main>
  );
}
