'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { GuidedDiagnosticV1 } from '@/lib/marketing/guided-diagnostic-types';
import { serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import { isGuidedDiagnosticExplicitReset } from '@teqmd/diagnostic-core/diagnostic-session-complete';
import {
  buildDiagnosticSessionPersistBody,
  computeDiagnosticSessionPersistPayloadHash,
  computeGuidedPersistCheckpointKey,
  DIAGNOSTIC_SESSION_PERSIST_API_URL,
  resolveDiagnosticSessionPersistDebounceMs,
  type DiagnosticSessionPersistRequest,
} from '@/lib/marketing/diagnostic-session-persist';

type PersistOptions = {
  readonly completedOverride?: boolean;
  readonly force?: boolean;
};

type PersistQueueItem = {
  readonly guided: GuidedDiagnosticV1;
  readonly options?: PersistOptions;
};

type UseDiagnosticSessionPersistInput = {
  readonly guided: GuidedDiagnosticV1;
  readonly isSessionReady: boolean;
  readonly sessionReadOnlyRef: React.RefObject<boolean>;
  readonly sessionTargetId: string | null;
  readonly persistedSessionRef: string | null;
  readonly onPersistedSessionRef: (sessionId: string | null) => void;
  readonly hasHydratedRef: React.RefObject<boolean>;
};

function parseDiagnosticSessionIdFromApiPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const raw = (payload as { sessionId?: unknown }).sessionId;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Coalesced, checkpoint-aware persistence for the marketing diagnostic wizard.
 */
export function useDiagnosticSessionPersist(input: UseDiagnosticSessionPersistInput): {
  readonly flushPersist: (guided: GuidedDiagnosticV1, options?: PersistOptions) => void;
  readonly persistImmediate: (guided: GuidedDiagnosticV1, options?: PersistOptions) => Promise<void>;
  readonly markPersistedFromServer: (guided: GuidedDiagnosticV1, hasEverCompleted: boolean) => void;
  readonly resetPersistTracking: () => void;
} {
  const {
    guided,
    isSessionReady,
    sessionReadOnlyRef,
    sessionTargetId,
    persistedSessionRef,
    onPersistedSessionRef,
    hasHydratedRef,
  } = input;
  const hasEverCompletedRef = useRef<boolean>(false);
  const lastPersistedHashRef = useRef<string | null>(null);
  const lastCheckpointKeyRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingPersistRef = useRef<PersistQueueItem | null>(null);
  const runPersistQueueRef = useRef<(next: PersistQueueItem) => Promise<void>>(async () => undefined);
  const clearScheduledPersist = useCallback((): void => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);
  const buildPersistRequest = useCallback(
    (guided: GuidedDiagnosticV1, options?: PersistOptions): DiagnosticSessionPersistRequest => {
      const serializedGuided = serializeGuidedDiagnostic(guided);
      if (isGuidedDiagnosticExplicitReset(serializedGuided)) {
        hasEverCompletedRef.current = false;
      }
      if (guided.outcome !== null && guided.activeRound === null) {
        hasEverCompletedRef.current = true;
      }
      return {
        guided,
        sessionTargetId,
        persistedSessionRef,
        hasEverCompleted: hasEverCompletedRef.current,
        completedOverride: options?.completedOverride,
      };
    },
    [persistedSessionRef, sessionTargetId],
  );
  const executePersist = useCallback(
    async (guided: GuidedDiagnosticV1, options?: PersistOptions): Promise<void> => {
      if (sessionReadOnlyRef.current) {
        return;
      }
      const request = buildPersistRequest(guided, options);
      const payloadHash = computeDiagnosticSessionPersistPayloadHash(request);
      if (!options?.force && payloadHash === lastPersistedHashRef.current) {
        return;
      }
      const body = buildDiagnosticSessionPersistBody(request);
      const response = await fetch(DIAGNOSTIC_SESSION_PERSIST_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        lastPersistedHashRef.current = payloadHash;
        lastCheckpointKeyRef.current = computeGuidedPersistCheckpointKey(guided);
        const payload: unknown = await response.json().catch(() => ({}));
        onPersistedSessionRef(parseDiagnosticSessionIdFromApiPayload(payload));
        return;
      }
      if (response.status === 429) {
        const payload = (await response.json().catch(() => ({}))) as { retryAfterSeconds?: number };
        const retryAfterSeconds =
          typeof payload.retryAfterSeconds === 'number' && payload.retryAfterSeconds > 0
            ? payload.retryAfterSeconds
            : 30;
        clearScheduledPersist();
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          void runPersistQueueRef.current({ guided, options: { ...options, force: true } });
        }, retryAfterSeconds * 1000);
      }
    },
    [buildPersistRequest, clearScheduledPersist, onPersistedSessionRef, sessionReadOnlyRef],
  );
  const runPersistQueue = useCallback(
    async (next: PersistQueueItem): Promise<void> => {
      if (inFlightRef.current !== null) {
        pendingPersistRef.current = next;
        await inFlightRef.current;
        const pending = pendingPersistRef.current;
        pendingPersistRef.current = null;
        if (pending !== null) {
          await runPersistQueueRef.current(pending);
        }
        return;
      }
      inFlightRef.current = executePersist(next.guided, next.options).finally(() => {
        inFlightRef.current = null;
      });
      await inFlightRef.current;
      const pending = pendingPersistRef.current;
      pendingPersistRef.current = null;
      if (pending !== null) {
        await runPersistQueueRef.current(pending);
      }
    },
    [executePersist],
  );
  useEffect(() => {
    runPersistQueueRef.current = runPersistQueue;
  }, [runPersistQueue]);
  const persistImmediate = useCallback(
    async (guided: GuidedDiagnosticV1, options?: PersistOptions): Promise<void> => {
      clearScheduledPersist();
      await runPersistQueue({ guided, options });
    },
    [clearScheduledPersist, runPersistQueue],
  );
  const flushPersist = useCallback(
    (guided: GuidedDiagnosticV1, options?: PersistOptions): void => {
      void persistImmediate(guided, options);
    },
    [persistImmediate],
  );
  const schedulePersist = useCallback(
    (guided: GuidedDiagnosticV1, options?: PersistOptions): void => {
      clearScheduledPersist();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void persistImmediate(guided, options);
      }, resolveDiagnosticSessionPersistDebounceMs(guided));
    },
    [clearScheduledPersist, persistImmediate],
  );
  const markPersistedFromServer = useCallback((guided: GuidedDiagnosticV1, hasEverCompleted: boolean): void => {
    hasEverCompletedRef.current = hasEverCompleted;
    const request: DiagnosticSessionPersistRequest = {
      guided,
      sessionTargetId,
      persistedSessionRef,
      hasEverCompleted,
    };
    lastPersistedHashRef.current = computeDiagnosticSessionPersistPayloadHash(request);
    lastCheckpointKeyRef.current = computeGuidedPersistCheckpointKey(guided);
  }, [persistedSessionRef, sessionTargetId]);
  const resetPersistTracking = useCallback((): void => {
    hasEverCompletedRef.current = false;
    lastPersistedHashRef.current = null;
    lastCheckpointKeyRef.current = null;
    clearScheduledPersist();
  }, [clearScheduledPersist]);
  useEffect(() => {
    if (!isSessionReady || !hasHydratedRef.current || sessionReadOnlyRef.current) {
      return;
    }
    const checkpointKey = computeGuidedPersistCheckpointKey(guided);
    const checkpointChanged = checkpointKey !== lastCheckpointKeyRef.current;
    if (checkpointChanged) {
      lastCheckpointKeyRef.current = checkpointKey;
      const completedOverride = guided.outcome !== null && guided.activeRound === null ? true : undefined;
      flushPersist(guided, { completedOverride });
      return;
    }
    schedulePersist(guided);
  }, [flushPersist, guided, hasHydratedRef, isSessionReady, sessionReadOnlyRef, schedulePersist]);
  useEffect(() => {
    if (!isSessionReady || sessionReadOnlyRef.current) {
      return;
    }
    function flushBeforeLeave(): void {
      void persistImmediate(guided, { force: true });
    }
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        flushBeforeLeave();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushBeforeLeave);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushBeforeLeave);
    };
  }, [guided, isSessionReady, sessionReadOnlyRef, persistImmediate]);
  useEffect(() => {
    return () => {
      clearScheduledPersist();
    };
  }, [clearScheduledPersist]);
  return {
    flushPersist,
    persistImmediate,
    markPersistedFromServer,
    resetPersistTracking,
  };
}
