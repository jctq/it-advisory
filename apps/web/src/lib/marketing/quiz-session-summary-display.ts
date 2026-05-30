import { resolveQuizSessionDisplayPreview } from '@techmd/diagnostic-core/quiz-session-display-preview';
import type { QuizSessionDisplayPreview } from '@techmd/diagnostic-core/quiz-session-display-preview';

/**
 * List-row display copy: prefer live quiz answers, then booking snapshot when checkout cleared live fields.
 */
export function resolveQuizSessionSummaryDisplayPreview(input: {
  readonly guidedDiagnosticRaw: string | null;
  readonly situationAnswer: string | null;
  readonly bookingGuidedDiagnosticSnapshot: string | null;
}): QuizSessionDisplayPreview {
  const livePreview = resolveQuizSessionDisplayPreview({
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
  const snapshotPreview = resolveQuizSessionDisplayPreview({
    guidedDiagnosticRaw: snapshotRaw,
    situationAnswer: input.situationAnswer,
  });
  return {
    sessionTitlePreview: hasLiveTitle ? livePreview.sessionTitlePreview : snapshotPreview.sessionTitlePreview,
    situationPreview: hasLiveSituation ? livePreview.situationPreview : snapshotPreview.situationPreview,
    situationLabel: livePreview.situationLabel ?? snapshotPreview.situationLabel,
  };
}
