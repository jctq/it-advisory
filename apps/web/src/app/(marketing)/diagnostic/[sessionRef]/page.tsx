import { Suspense, type ReactElement } from 'react';
import { DiagnosticFlow } from '../diagnostic-flow';
import { DiagnosticRouteLoadingFallback } from '../diagnostic-route-loading-fallback';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Guided diagnostic · TeqMD',
  description:
    'Describe your situation, answer short guided intake questions, then finish the diagnostic for a tailored recommendation.',
});

type DiagnosticSessionRefPageProps = {
  readonly params: Promise<{ readonly sessionRef: string }>;
};

export default async function DiagnosticSessionRefPage(props: DiagnosticSessionRefPageProps): Promise<ReactElement> {
  const { sessionRef } = await props.params;
  const decoded = decodeURIComponent(sessionRef.trim());
  return (
    <main>
      <Suspense fallback={<DiagnosticRouteLoadingFallback />}>
        <DiagnosticFlow pathSessionRef={decoded} />
      </Suspense>
    </main>
  );
}
