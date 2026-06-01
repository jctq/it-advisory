import { resolveDiagnosticSessionDisplayPreview } from '@teqmd/diagnostic-core/diagnostic-session-display-preview';
import type { DiagnosticSessionDisplayPreview } from '@teqmd/diagnostic-core/diagnostic-session-display-preview';

/**
 * List-row display copy: prefer live diagnostic answers, then booking snapshot when checkout cleared live fields.
 */
export function resolveDiagnosticSessionSummaryDisplayPreview(input: {
  readonly guidedDiagnosticRaw: string | null;
  readonly situationAnswer: string | null;
  readonly bookingGuidedDiagnosticSnapshot: string | null;
}): DiagnosticSessionDisplayPreview {
  const livePreview = resolveDiagnosticSessionDisplayPreview({
    guidedDiagnosticRaw: input.guidedDiagnosticRaw,
    situationAnswer: input.situationAnswer,
  });
  const hasLiveTitle =
    livePreview.sessionTitlePreview !== null && livePreview.sessionTitlePreview.length > 0;
  const hasLiveSituation =
    livePreview.situationPreview !== null && livePreview.situationPreview.length > 0;
  if (hasLiveTitle && hasLiveSituation) {
    return livePreview;
  }
  const snapshotRaw = input.bookingGuidedDiagnosticSnapshot?.trim() ?? '';
  if (snapshotRaw.length === 0) {
    return livePreview;
  }
  const snapshotPreview = resolveDiagnosticSessionDisplayPreview({
    guidedDiagnosticRaw: snapshotRaw,
    situationAnswer: input.situationAnswer,
  });
  return {
    sessionTitlePreview: hasLiveTitle ? livePreview.sessionTitlePreview : snapshotPreview.sessionTitlePreview,
    situationPreview: hasLiveSituation ? livePreview.situationPreview : snapshotPreview.situationPreview,
    situationLabel: livePreview.situationLabel ?? snapshotPreview.situationLabel,
  };
}
