'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { isPlausibleMarketingDiagnosticSessionRef, buildMarketingDiagnosticSessionPath } from '@/lib/marketing/diagnostic-session-marketing-ref';

const MY_SESSIONS_API_URL = '/api/diagnostic/my-sessions';
const DIAGNOSTIC_SESSION_API_URL = '/api/diagnostic/session';

function parseDiagnosticSessionIdFromGuestFreshStartPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const raw = (payload as { sessionId?: unknown }).sessionId;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return isPlausibleMarketingDiagnosticSessionRef(trimmed) ? trimmed : null;
}

/**
 * Clears the visitor's latest diagnostic session row before an explicit “new diagnostic”. Booked sessions are forked to a new blank
 * row; in-progress rows are deleted. Call before navigating to `/diagnostic` so guests do not reopen a prior snapshot.
 */
export async function ensureGuestDiagnosticFreshStart(): Promise<void> {
  const response = await fetch(DIAGNOSTIC_SESSION_API_URL, { credentials: 'include' });
  if (!response.ok) {
    return;
  }
  const payload: unknown = await response.json().catch(() => ({}));
  const sessionId = parseDiagnosticSessionIdFromGuestFreshStartPayload(payload);
  if (sessionId === null) {
    return;
  }
  await fetch(DIAGNOSTIC_SESSION_API_URL, { method: 'DELETE', credentials: 'include' });
}

/**
 * Creates a new empty diagnostic session for the signed-in marketing account.
 * @throws Error when the request fails or the response is invalid.
 */
export async function postNewMarketingDiagnosticSession(): Promise<string> {
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

type UseMarketingNewDiagnosticNavigationResult = {
  readonly navigateToNewDiagnostic: () => Promise<void>;
  readonly isNavigating: boolean;
};

/**
 * For signed-in users, starts a fresh diagnostic row and navigates to `/diagnostic/[sessionRef]`.
 * Guests go to `/diagnostic` (visitor latest-session behavior).
 * @param onNavigateError Optional handler instead of `window.alert` on failure (e.g. inline form error).
 */
export function useMarketingNewDiagnosticNavigation(
  isAuthenticated: boolean,
  onNavigateError?: (message: string) => void,
): UseMarketingNewDiagnosticNavigationResult {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const navigateToNewDiagnostic = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) {
      setIsNavigating(true);
      try {
        await ensureGuestDiagnosticFreshStart();
        router.push('/diagnostic');
      } finally {
        setIsNavigating(false);
      }
      return;
    }
    setIsNavigating(true);
    try {
      const sessionId = await postNewMarketingDiagnosticSession();
      router.push(buildMarketingDiagnosticSessionPath(sessionId));
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
  return { navigateToNewDiagnostic, isNavigating };
}

type UseMarketingActiveDiagnosticNavigationResult = {
  readonly navigateToActiveDiagnostic: () => Promise<void>;
  readonly isNavigating: boolean;
};

/**
 * Opens the visitor's latest diagnostic row when no session ref is known, or `/diagnostic/[sessionRef]` when the API returns one.
 */
export function useMarketingActiveDiagnosticNavigation(
  onNavigateError?: (message: string) => void,
): UseMarketingActiveDiagnosticNavigationResult {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const navigateToActiveDiagnostic = useCallback(async (): Promise<void> => {
    setIsNavigating(true);
    try {
      const response = await fetch(DIAGNOSTIC_SESSION_API_URL, { credentials: 'include' });
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
      if (sessionId !== null && isPlausibleMarketingDiagnosticSessionRef(sessionId)) {
        router.push(buildMarketingDiagnosticSessionPath(sessionId));
        return;
      }
      router.push('/diagnostic');
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
  return { navigateToActiveDiagnostic, isNavigating };
}
