import { parseGuidedDiagnosticJson, type GuidedDiagnosticV1 } from './guided-diagnostic-types';
import {
  PROJECT_RESCUE_SERVICE_TAGLINE,
  PROJECT_RESCUE_SERVICE_TITLE,
} from './project-rescue-service-context';

const SESSION_TITLE_PREVIEW_MAX_LENGTH = 90;
const SITUATION_PREVIEW_MAX_LENGTH = 120;
const INITIAL_PROMPT_TITLE_MAX_LENGTH = 80;

export type QuizSessionDisplayPreview = {
  /** Personalized session headline when available; otherwise opening prompt or null. */
  readonly sessionTitlePreview: string | null;
  /** Customer-facing summary line (brief assessment, prompt, or mapped situation). */
  readonly situationPreview: string | null;
  /** Canonical mapped situation label for chips and filters. */
  readonly situationLabel: string | null;
};

function truncatePreview(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return '';
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function isGenericSessionTitle(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === PROJECT_RESCUE_SERVICE_TITLE;
}

function isGenericBriefAssessment(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === PROJECT_RESCUE_SERVICE_TAGLINE;
}

function resolveFromGuided(
  guided: GuidedDiagnosticV1 | null,
  situationAnswer: string | null,
): QuizSessionDisplayPreview {
  const outcome = guided?.outcome ?? null;
  const initialPrompt = guided?.initialPrompt?.trim() ?? '';
  const mappedSituation = outcome?.mappedSituation?.trim() ?? situationAnswer?.trim() ?? '';
  let sessionTitlePreview: string | null = null;
  if (outcome !== null) {
    const sessionTitle = outcome.sessionTitle.trim();
    if (!isGenericSessionTitle(sessionTitle)) {
      sessionTitlePreview = truncatePreview(sessionTitle, SESSION_TITLE_PREVIEW_MAX_LENGTH);
    }
  }
  if (sessionTitlePreview === null && initialPrompt.length > 0) {
    sessionTitlePreview = truncatePreview(initialPrompt, INITIAL_PROMPT_TITLE_MAX_LENGTH);
  }
  let situationPreview: string | null = null;
  if (outcome !== null) {
    const briefAssessment = outcome.briefAssessment.trim();
    if (!isGenericBriefAssessment(briefAssessment)) {
      situationPreview = truncatePreview(briefAssessment, SITUATION_PREVIEW_MAX_LENGTH);
    }
  }
  if (situationPreview === null && initialPrompt.length > 0) {
    const promptSummary = truncatePreview(initialPrompt, SITUATION_PREVIEW_MAX_LENGTH);
    if (promptSummary !== sessionTitlePreview) {
      situationPreview = promptSummary;
    }
  }
  if (situationPreview === null && mappedSituation.length > 0) {
    situationPreview = truncatePreview(mappedSituation, SITUATION_PREVIEW_MAX_LENGTH);
  }
  const situationLabel = mappedSituation.length > 0 ? mappedSituation : null;
  return {
    sessionTitlePreview,
    situationPreview,
    situationLabel,
  };
}

/**
 * Resolves list/title copy for quiz session rows from persisted guided diagnostic JSON and answers.
 */
export function resolveQuizSessionDisplayPreview(params: {
  readonly guidedDiagnosticRaw: string | null;
  readonly situationAnswer: string | null | undefined;
}): QuizSessionDisplayPreview {
  const situationAnswer =
    typeof params.situationAnswer === 'string' && params.situationAnswer.trim().length > 0
      ? params.situationAnswer.trim()
      : null;
  const guided =
    params.guidedDiagnosticRaw !== null && params.guidedDiagnosticRaw.trim().length > 0
      ? parseGuidedDiagnosticJson(params.guidedDiagnosticRaw)
      : null;
  return resolveFromGuided(guided, situationAnswer);
}
