'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

const MY_SESSIONS_API_URL = '/api/quiz/my-sessions';

/**
 * Creates a new empty quiz session for the signed-in marketing account.
 * @throws Error when the request fails or the response is invalid.
 */
export async function postNewMarketingQuizSession(): Promise<string> {
  const response = await fetch(MY_SESSIONS_API_URL, { method: 'POST', credentials: 'include' });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'Could not start a new diagnostic.';
    throw new Error(message);
  }
  const sessionId =
    typeof payload === 'object' && payload !== null && 'sessionId' in payload && typeof (payload as { sessionId?: unknown }).sessionId === 'string'
      ? (payload as { sessionId: string }).sessionId
      : null;
  if (sessionId === null) {
    throw new Error('Invalid response from server.');
  }
  return sessionId;
}

type UseMarketingNewQuizNavigationResult = {
  readonly navigateToNewQuiz: () => Promise<void>;
  readonly isNavigating: boolean;
};

/**
 * For signed-in users, starts a fresh diagnostic row and navigates with `?sessionId=`.
 * Guests go to `/quiz` (visitor latest-session behavior).
 * @param onNavigateError Optional handler instead of `window.alert` on failure (e.g. inline form error).
 */
export function useMarketingNewQuizNavigation(
  isAuthenticated: boolean,
  onNavigateError?: (message: string) => void,
): UseMarketingNewQuizNavigationResult {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const navigateToNewQuiz = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) {
      router.push('/quiz');
      return;
    }
    setIsNavigating(true);
    try {
      const sessionId = await postNewMarketingQuizSession();
      router.push(`/quiz?sessionId=${encodeURIComponent(sessionId)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start a new diagnostic.';
      if (onNavigateError !== undefined) {
        onNavigateError(message);
      } else {
        window.alert(message);
      }
    } finally {
      setIsNavigating(false);
    }
  }, [isAuthenticated, onNavigateError, router]);
  return { navigateToNewQuiz, isNavigating };
}
