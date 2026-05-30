import { describe, expect, it } from 'vitest';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  serializeGuidedDiagnostic,
} from '@techmd/diagnostic-core/guided-diagnostic-types';
import { resolveQuizSessionSummaryDisplayPreview } from './quiz-session-summary-display';

describe('resolveQuizSessionSummaryDisplayPreview', () => {
  it('falls back to booking snapshot when live answers lost title', () => {
    const guided = {
      ...GUIDED_DIAGNOSTIC_EMPTY,
      initialPrompt: 'We need help with a delayed ERP rollout',
      activeRound: null,
      outcome: {
        mappedSituation: 'Vendor keeps missing timelines',
        advisorSummary: 'Internal summary',
        briefAssessment: 'Vendor timelines are slipping',
        sessionTitle: 'Rescue plan for ERP rollout',
        goodFitBullets: ['A', 'B', 'C'],
        recommendedServiceKey: 'project-rescue',
      },
    };
    const snapshot = serializeGuidedDiagnostic(guided);
    const preview = resolveQuizSessionSummaryDisplayPreview({
      guidedDiagnosticRaw: null,
      situationAnswer: null,
      bookingGuidedDiagnosticSnapshot: snapshot,
    });
    expect(preview.sessionTitlePreview).toBe('Rescue plan for ERP rollout');
  });
});
