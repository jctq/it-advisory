'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';

type ServiceReviewDiagnosticButtonProps = {
  readonly isAuthenticated: boolean;
};

export function ServiceReviewDiagnosticButton(props: ServiceReviewDiagnosticButtonProps): ReactElement {
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(props.isAuthenticated);
  if (props.isAuthenticated) {
    return (
      <Button variant="outline" className="mt-3 w-full" disabled={isNavigating} onClick={() => void navigateToNewQuiz()}>
        {isNavigating ? 'Opening…' : 'Review diagnostic'}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" className="mt-3 w-full">
      <Link href="/quiz">Review diagnostic</Link>
    </Button>
  );
}
