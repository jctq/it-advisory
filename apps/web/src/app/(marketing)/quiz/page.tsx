import type { Metadata } from 'next';
import { Suspense, type ReactElement } from 'react';
import { QuizFlow } from './quiz-flow';
import { QuizRouteLoadingFallback } from './quiz-route-loading-fallback';

export const metadata: Metadata = {
  title: 'Guided diagnostic · IT Advisory',
  description:
    'Describe your situation, answer short guided intake questions, then finish the diagnostic for a tailored recommendation.',
};

export default function QuizPage(): ReactElement {
  return (
    <main>
      <Suspense fallback={<QuizRouteLoadingFallback />}>
        <QuizFlow />
      </Suspense>
    </main>
  );
}
