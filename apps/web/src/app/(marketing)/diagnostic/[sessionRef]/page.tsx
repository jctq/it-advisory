import { Suspense, type ReactElement } from 'react';
import { QuizFlow } from '../quiz-flow';
import { QuizRouteLoadingFallback } from '../quiz-route-loading-fallback';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Guided diagnostic · TechMD',
  description:
    'Describe your situation, answer short guided intake questions, then finish the diagnostic for a tailored recommendation.',
});

type QuizSessionRefPageProps = {
  readonly params: Promise<{ readonly sessionRef: string }>;
};

export default async function QuizSessionRefPage(props: QuizSessionRefPageProps): Promise<ReactElement> {
  const { sessionRef } = await props.params;
  const decoded = decodeURIComponent(sessionRef.trim());
  return (
    <main>
      <Suspense fallback={<QuizRouteLoadingFallback />}>
        <QuizFlow pathSessionRef={decoded} />
      </Suspense>
    </main>
  );
}
