'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { isPlausibleMarketingQuizSessionRef, buildMarketingQuizSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';

const MY_SESSIONS_API_URL = '/api/quiz/my-sessions';
const QUIZ_SESSION_API_URL = '/api/quiz/session';

/**
 * When the visitor's latest quiz row is read-only (linked to a booking), `DELETE /api/quiz/session` forks a new
 * blank row. Call this before navigating to `/quiz` so guests do not reopen a completed, booked snapshot after
 * checkout if the client missed the booking success `DELETE`.
 */
export async function ensureGuestQuizFreshStart(): Promise<void> {
  const response = await fetch(QUIZ_SESSION_API_URL, { credentials: 'include' });
  if (!response.ok) {
    return;
  }
  const payload: unknown = await response.json().catch(() => ({}));
  const readOnly =
    typeof payload === 'object' &&
    payload !== null &&
    'readOnly' in payload &&
    (payload as { readOnly?: unknown }).readOnly === true;
  if (!readOnly) {
    return;
  }
  await fetch(QUIZ_SESSION_API_URL, { method: 'DELETE', credentials: 'include' });
}

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
 * For signed-in users, starts a fresh diagnostic row and navigates to `/quiz/[sessionRef]`.
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
      setIsNavigating(true);
      try {
        await ensureGuestQuizFreshStart();
        router.push('/quiz');
      } finally {
        setIsNavigating(false);
      }
      return;
    }
    setIsNavigating(true);
    try {
      const sessionId = await postNewMarketingQuizSession();
      router.push(buildMarketingQuizSessionPath(sessionId));
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

type UseMarketingActiveQuizNavigationResult = {
  readonly navigateToActiveQuiz: () => Promise<void>;
  readonly isNavigating: boolean;
};

/**
 * Opens the visitor's latest diagnostic row when no session ref is known, or `/quiz/[sessionRef]` when the API returns one.
 */
export function useMarketingActiveQuizNavigation(
  onNavigateError?: (message: string) => void,
): UseMarketingActiveQuizNavigationResult {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const navigateToActiveQuiz = useCallback(async (): Promise<void> => {
    setIsNavigating(true);
    try {
      const response = await fetch(QUIZ_SESSION_API_URL, { credentials: 'include' });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Could not load your diagnostic.';
        throw new Error(message);
      }
      const sessionId =
        typeof payload === 'object' && payload !== null && 'sessionId' in payload && typeof (payload as { sessionId?: unknown }).sessionId === 'string'
          ? (payload as { sessionId: string }).sessionId
          : null;
      if (sessionId !== null && isPlausibleMarketingQuizSessionRef(sessionId)) {
        router.push(buildMarketingQuizSessionPath(sessionId));
        return;
      }
      router.push('/quiz');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open your diagnostic.';
      if (onNavigateError !== undefined) {
        onNavigateError(message);
      } else {
        window.alert(message);
      }
    } finally {
      setIsNavigating(false);
    }
  }, [onNavigateError, router]);
  return { navigateToActiveQuiz, isNavigating };
}
