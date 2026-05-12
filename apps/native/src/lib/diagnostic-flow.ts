import {
  buildDiagnosticThreadJson,
  computeGuidedLinearStep,
  formatGuidedQuestionAnswer,
  serializeGuidedDiagnostic,
  type ActiveGuidedRound,
  type CompletedRoundBundle,
  type GuidedDiagnosticV1,
} from '@it-advisory/diagnostic-core/guided-diagnostic-types';

export const MIN_PROMPT_LENGTH = 8;

/**
 * Converts the guided diagnostic state into the persisted quiz-session answer payload.
 */
export function buildQuizAnswersPayload(
  guided: GuidedDiagnosticV1,
): Record<string, string | number | boolean | string[]> {
  return {
    guidedDiagnostic: serializeGuidedDiagnostic(guided),
    situation: guided.outcome?.mappedSituation ?? '',
    situationAdvisorSummary: guided.outcome?.advisorSummary ?? '',
    situationDiagnosticThread: buildDiagnosticThreadJson(guided),
  };
}

/**
 * Normalizes quiz-session payloads that may come back as either JSON strings or nested documents.
 */
export function normalizeGuidedDiagnosticRaw(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    return raw;
  }
  if (raw !== undefined && raw !== null && typeof raw === 'object') {
    try {
      return JSON.stringify(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Adds or removes a suggested prompt phrase from the free-text diagnostic prompt.
 */
export function togglePromptWithSeed(currentPrompt: string, phrase: string): string {
  const trimmedCurrent = currentPrompt.trim();
  if (trimmedCurrent.length === 0) {
    return phrase;
  }
  const lines = trimmedCurrent.split(/\r?\n/).map((line) => line.trim());
  const matchIndex = lines.findIndex((line) => line.toLowerCase() === phrase.toLowerCase());
  if (matchIndex >= 0) {
    return lines
      .filter((_, index) => index !== matchIndex)
      .filter((line) => line.length > 0)
      .join('\n');
  }
  return `${trimmedCurrent}\n${phrase}`;
}

/**
 * Builds the UX progress label and percentage for the current state.
 */
export function buildDiagnosticProgress(guided: GuidedDiagnosticV1): {
  readonly hint: string;
  readonly percent: number;
} {
  if (guided.outcome !== null) {
    return {
      hint: 'Summary',
      percent: 100,
    };
  }
  if (guided.activeRound !== null) {
    const completedQuestions = guided.completedBundles.reduce((sum, bundle) => sum + bundle.questions.length, 0);
    const ordinal = completedQuestions + guided.activeRound.stepIndex + 1;
    return {
      hint: `Question ${ordinal}`,
      percent: Math.min(94, 6 + computeGuidedLinearStep(guided) * 9),
    };
  }
  return {
    hint: 'Describe',
    percent: Math.min(94, 6 + computeGuidedLinearStep(guided) * 9),
  };
}

/**
 * Converts the active round into an immutable completed bundle snapshot.
 */
export function buildCompletedRoundBundle(activeRound: ActiveGuidedRound | null): CompletedRoundBundle | null {
  if (activeRound === null) {
    return null;
  }
  return {
    roundIndex: activeRound.roundIndex,
    questions: activeRound.questions,
    answers: { ...activeRound.answers },
    answerNotes: { ...activeRound.answerNotes },
    guidance: activeRound.guidance,
  };
}

/**
 * Returns the current answer text for validation and persistence decisions.
 */
export function buildCurrentAnswerText(guided: GuidedDiagnosticV1): string {
  if (guided.activeRound === null) {
    return '';
  }
  const currentQuestion = guided.activeRound.questions[guided.activeRound.stepIndex];
  if (currentQuestion === undefined) {
    return '';
  }
  return formatGuidedQuestionAnswer(
    guided.activeRound.answers[currentQuestion.id] ?? '',
    guided.activeRound.answerNotes[currentQuestion.id] ?? '',
  );
}
