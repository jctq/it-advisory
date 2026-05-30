import { describe, expect, it } from 'vitest';
import { resolveAccountDiagnosticListTitle } from './quiz-session-list-display';

describe('resolveAccountDiagnosticListTitle', () => {
  it('does not use booking reference as session title', () => {
    expect(
      resolveAccountDiagnosticListTitle({
        sessionTitlePreview: null,
        situationPreview: null,
        bookingReferenceId: '11E2F9CF',
        hasGuidedDiagnostic: true,
      }),
    ).toBe('Guided diagnostic');
  });

  it('prefers session title preview when present', () => {
    expect(
      resolveAccountDiagnosticListTitle({
        sessionTitlePreview: 'Stabilize vendor delivery',
        situationPreview: 'Timeline risk',
        bookingReferenceId: '11E2F9CF',
        hasGuidedDiagnostic: true,
      }),
    ).toBe('Stabilize vendor delivery');
  });
});
