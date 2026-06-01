import { parseGuidedDiagnosticJson } from './guided-diagnostic-types';

export type ResolveDiagnosticSessionCompletedInput = {
  readonly completedAtIso: string | null;
  readonly guidedDiagnosticRaw: string | null;
};

/**
 * Whether the visitor finished the diagnostic (persisted timestamp or guided outcome).
 */
export function resolveDiagnosticSessionCompleted(
  input: ResolveDiagnosticSessionCompletedInput,
): boolean {
  if (input.completedAtIso !== null) {
    return true;
  }
  if (input.guidedDiagnosticRaw === null || input.guidedDiagnosticRaw.trim().length === 0) {
    return false;
  }
  const guided = parseGuidedDiagnosticJson(input.guidedDiagnosticRaw);
  return guided !== null && guided.outcome !== null && guided.activeRound === null;
}
