import { describe, expect, it } from 'vitest';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  serializeGuidedDiagnostic,
} from '@teqmd/diagnostic-core/guided-diagnostic-types';
import {
  isGuidedDiagnosticExplicitReset,
  resolveDiagnosticSessionCompleted,
} from '@teqmd/diagnostic-core/diagnostic-session-complete';

describe('resolveDiagnosticSessionCompleted', () => {
  it('returns true when completedAt is set', () => {
    expect(
      resolveDiagnosticSessionCompleted({
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
      resolveDiagnosticSessionCompleted({
        completedAtIso: null,
        guidedDiagnosticRaw: serializeGuidedDiagnostic(guided),
      }),
    ).toBe(true);
  });

  it('returns false for in-progress guided state', () => {
    expect(
      resolveDiagnosticSessionCompleted({
        completedAtIso: null,
        guidedDiagnosticRaw: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
      }),
    ).toBe(false);
  });

  it('treats blank guided payloads as explicit reset', () => {
    expect(isGuidedDiagnosticExplicitReset(null)).toBe(true);
    expect(isGuidedDiagnosticExplicitReset(serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY))).toBe(true);
    expect(
      isGuidedDiagnosticExplicitReset(
        serializeGuidedDiagnostic({
          ...GUIDED_DIAGNOSTIC_EMPTY,
          initialPrompt: 'Still in progress',
        }),
      ),
    ).toBe(false);
  });
});
