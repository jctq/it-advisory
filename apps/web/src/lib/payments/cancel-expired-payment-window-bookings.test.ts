import { describe, expect, it } from 'vitest';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  serializeGuidedDiagnostic,
} from '@techmd/diagnostic-core/guided-diagnostic-types';
import { resolveQuizSessionDiagnosticCompleted } from '@techmd/diagnostic-core/quiz-session-diagnostic-complete';

describe('resolveQuizSessionDiagnosticCompleted', () => {
  it('returns true when completedAt is set', () => {
    expect(
      resolveQuizSessionDiagnosticCompleted({
        completedAtIso: '2026-01-01T00:00:00.000Z',
        guidedDiagnosticRaw: null,
      }),
    ).toBe(true);
  });

  it('returns true when guided outcome is present and no active round', () => {
    const guided = {
      ...GUIDED_DIAGNOSTIC_EMPTY,
      outcome: {
        mappedSituation: 'test',
        advisorSummary: 'summary',
        sessionTitle: 'Session',
        briefAssessment: '',
        goodFitBullets: ['a', 'b', 'c'],
        recommendedServiceKey: 'project-rescue',
      },
      activeRound: null,
    };
    expect(
      resolveQuizSessionDiagnosticCompleted({
        completedAtIso: null,
        guidedDiagnosticRaw: serializeGuidedDiagnostic(guided),
      }),
    ).toBe(true);
  });

  it('returns false for in-progress guided state', () => {
    expect(
      resolveQuizSessionDiagnosticCompleted({
        completedAtIso: null,
        guidedDiagnosticRaw: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
      }),
    ).toBe(false);
  });
});
