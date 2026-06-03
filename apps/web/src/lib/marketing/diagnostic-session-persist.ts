import {
  buildDiagnosticThreadJson,
  computeGuidedLinearStep,
  serializeGuidedDiagnostic,
  type GuidedDiagnosticV1,
} from '@/lib/marketing/guided-diagnostic-types';
import { isGuidedDiagnosticExplicitReset } from '@teqmd/diagnostic-core/diagnostic-session-complete';

export const DIAGNOSTIC_SESSION_PERSIST_API_URL = '/api/diagnostic/session' as const;

/** Debounced save while the user edits answers/notes on the same step. */
export const DIAGNOSTIC_SESSION_PERSIST_DEBOUNCE_MS = 2500 as const;

/** Debounced save while the user types the initial prompt. */
export const DIAGNOSTIC_SESSION_PROMPT_PERSIST_DEBOUNCE_MS = 4000 as const;

export type DiagnosticSessionPersistBody = {
  readonly answers: Record<string, string | number | boolean | string[]>;
  readonly currentStep: number;
  readonly completed: boolean;
  readonly sessionId?: string;
};

export type DiagnosticSessionPersistRequest = {
  readonly guided: GuidedDiagnosticV1;
  readonly sessionTargetId: string | null;
  readonly persistedSessionRef: string | null;
  readonly hasEverCompleted: boolean;
  readonly completedOverride?: boolean;
};

export function buildDiagnosticSessionAnswersPayload(
  guided: GuidedDiagnosticV1,
): Record<string, string | number | boolean | string[]> {
  return {
    guidedDiagnostic: serializeGuidedDiagnostic(guided),
    situation: guided.outcome?.mappedSituation ?? '',
    situationAdvisorSummary: guided.outcome?.advisorSummary ?? '',
    situationDiagnosticThread: buildDiagnosticThreadJson(guided),
  };
}

export function resolveDiagnosticSessionPersistCompleted(input: DiagnosticSessionPersistRequest): boolean {
  const serializedGuided = serializeGuidedDiagnostic(input.guided);
  const isExplicitReset = isGuidedDiagnosticExplicitReset(serializedGuided);
  if (input.completedOverride !== undefined) {
    return input.completedOverride;
  }
  const derivedComplete =
    input.guided.outcome !== null && input.guided.activeRound === null;
  return derivedComplete || (input.hasEverCompleted && !isExplicitReset);
}

export function buildDiagnosticSessionPersistBody(
  input: DiagnosticSessionPersistRequest,
): DiagnosticSessionPersistBody {
  const activeSessionRef = input.sessionTargetId ?? input.persistedSessionRef;
  const body: DiagnosticSessionPersistBody = {
    answers: buildDiagnosticSessionAnswersPayload(input.guided),
    currentStep: computeGuidedLinearStep(input.guided),
    completed: resolveDiagnosticSessionPersistCompleted(input),
  };
  if (activeSessionRef !== null) {
    return { ...body, sessionId: activeSessionRef };
  }
  return body;
}

/**
 * Changes when the user crosses a wizard milestone (new step, round, outcome, prompt draft).
 * Answer/note edits within the same step share a checkpoint and use debounced persist.
 */
export function computeGuidedPersistCheckpointKey(guided: GuidedDiagnosticV1): string {
  return JSON.stringify({
    completedBundles: guided.completedBundles,
    activeRound:
      guided.activeRound === null
        ? null
        : {
            roundIndex: guided.activeRound.roundIndex,
            stepIndex: guided.activeRound.stepIndex,
            questionCount: guided.activeRound.questions.length,
          },
    hasOutcome: guided.outcome !== null,
  });
}

export function resolveDiagnosticSessionPersistDebounceMs(guided: GuidedDiagnosticV1): number {
  const inDescribePhase =
    guided.activeRound === null &&
    guided.completedBundles.length === 0 &&
    guided.outcome === null;
  return inDescribePhase
    ? DIAGNOSTIC_SESSION_PROMPT_PERSIST_DEBOUNCE_MS
    : DIAGNOSTIC_SESSION_PERSIST_DEBOUNCE_MS;
}

export function computeDiagnosticSessionPersistPayloadHash(
  input: DiagnosticSessionPersistRequest,
): string {
  return JSON.stringify(buildDiagnosticSessionPersistBody(input));
}
