import type { Metadata } from 'next';
import { Suspense, type ReactElement } from 'react';
import { QuizFlow } from './quiz-flow';

export const metadata: Metadata = {
  title: 'Guided diagnostic · IT Advisory',
  description:
    'Describe your situation, answer short guided intake questions, then finish the diagnostic for a tailored recommendation.',
};

function QuizLoadingFallback(): ReactElement {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="h-2 animate-pulse rounded-full bg-muted" aria-hidden />
      <div className="mt-10 h-8 max-w-md animate-pulse rounded-md bg-muted" aria-hidden />
      <div className="mt-4 h-4 max-w-lg animate-pulse rounded-md bg-muted/70" aria-hidden />
      <p className="sr-only">Loading your diagnostic progress</p>
    </div>
  );
}

export default function QuizPage(): ReactElement {
  return (
    <main>
      <Suspense fallback={<QuizLoadingFallback />}>
        <QuizFlow />
      </Suspense>
    </main>
  );
}
