export type DiagnosticQuestionOption = {
  readonly label: string;
  readonly description: string | null;
};

/**
 * Persisted guided quiz (replaces static QUIZ_STEPS). Stored as answers.guidedDiagnostic JSON.
 */
export type DiagnosticQuestionBlock = {
  readonly id: string;
  readonly prompt: string;
  readonly description: string | null;
  readonly options: readonly DiagnosticQuestionOption[];
};

export type DiagnosticThreadRound = {
  readonly roundIndex: number;
  readonly qa: readonly {
    readonly questionId: string;
    readonly question: string;
    readonly answer: string;
  }[];
};

export type CompletedRoundBundle = {
  readonly roundIndex: number;
  readonly questions: readonly DiagnosticQuestionBlock[];
  readonly answers: Readonly<Record<string, string>>;
  /** Free-text detail per question id (optional expansion beyond the tapped option). */
  readonly answerNotes: Readonly<Record<string, string>>;
  readonly guidance: string | null;
};

export type GuidedDiagnosticOutcome = {
  readonly mappedSituation: string;
  readonly advisorSummary: string;
};

export type ActiveGuidedRound = {
  readonly roundIndex: number;
  readonly questions: readonly DiagnosticQuestionBlock[];
  readonly answers: Record<string, string>;
  readonly answerNotes: Record<string, string>;
  readonly stepIndex: number;
  readonly guidance: string | null;
};

export type GuidedDiagnosticV1 = {
  readonly version: 1;
  readonly initialPrompt: string;
  readonly completedBundles: CompletedRoundBundle[];
  readonly activeRound: ActiveGuidedRound | null;
  readonly outcome: GuidedDiagnosticOutcome | null;
};

export const GUIDED_DIAGNOSTIC_EMPTY: GuidedDiagnosticV1 = {
  version: 1,
  initialPrompt: '',
  completedBundles: [],
  activeRound: null,
  outcome: null,
};

/**
 * Combines multiple-choice selection and optional typed detail for API/thread payloads.
 */
export function formatGuidedQuestionAnswer(selectedOption: string, detailNote: string): string {
  const trimmedOption = selectedOption.trim();
  const trimmedNote = detailNote.trim();
  if (trimmedOption.length > 0 && trimmedNote.length > 0) {
    return `${trimmedOption}\n\nExact answer: ${trimmedNote}`;
  }
  if (trimmedOption.length > 0) {
    return trimmedOption;
  }
  return trimmedNote;
}

export function serializeGuidedDiagnostic(state: GuidedDiagnosticV1): string {
  return JSON.stringify(state);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildDiagnosticOptionKey(value: string): string {
  return value.toLowerCase();
}

/**
 * Trims diagnostic options and removes duplicate labels while preserving order.
 */
export function normalizeDiagnosticOptions(input: readonly unknown[]): DiagnosticQuestionOption[] {
  const seen = new Set<string>();
  return input.flatMap((option) => {
    if (isNonEmptyString(option)) {
      const label = option.trim().replace(/\s+/g, ' ');
      const key = buildDiagnosticOptionKey(label);
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [{ label, description: null }];
    }
    if (option === null || typeof option !== 'object') {
      return [];
    }
    const candidate = option as {
      readonly description?: unknown;
      readonly label?: unknown;
    };
    if (!isNonEmptyString(candidate.label)) {
      return [];
    }
    const label = candidate.label.trim().replace(/\s+/g, ' ');
    const key = buildDiagnosticOptionKey(label);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    const normalizedDescription =
      typeof candidate.description === 'string'
        ? candidate.description.trim().replace(/\s+/g, ' ')
        : '';
    return [
      {
        label,
        description: normalizedDescription.length > 0 ? normalizedDescription : null,
      },
    ];
  });
}

/**
 * Returns only option labels, preserving the existing AI-round API contract.
 */
export function normalizeDiagnosticOptionLabels(input: readonly unknown[]): string[] {
  return normalizeDiagnosticOptions(input).map((option) => option.label);
}

function normalizeQuestionOptions(input: unknown): DiagnosticQuestionOption[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return normalizeDiagnosticOptions(input);
}

function normalizeDiagnosticQuestionBlocks(input: unknown): DiagnosticQuestionBlock[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }
    const question = candidate as {
      readonly description?: unknown;
      readonly id?: unknown;
      readonly options?: unknown;
      readonly prompt?: unknown;
    };
    if (!isNonEmptyString(question.prompt)) {
      return [];
    }
    const options = normalizeQuestionOptions(question.options);
    if (options.length === 0) {
      return [];
    }
    return [
      {
        id: isNonEmptyString(question.id) ? question.id.trim() : `question-${index + 1}`,
        prompt: question.prompt.trim(),
        description:
          typeof question.description === 'string' && question.description.trim().length > 0
            ? question.description.trim().replace(/\s+/g, ' ')
            : null,
        options,
      },
    ];
  });
}

function normalizeGuidedDiagnostic(parsed: GuidedDiagnosticV1): GuidedDiagnosticV1 {
  const bundles: CompletedRoundBundle[] = Array.isArray(parsed.completedBundles)
    ? parsed.completedBundles.flatMap((bundle, index) => {
        if (bundle === null || typeof bundle !== 'object') {
          return [];
        }
        const questions = normalizeDiagnosticQuestionBlocks(bundle.questions);
        if (questions.length === 0) {
          return [];
        }
        return [
          {
            roundIndex: typeof bundle.roundIndex === 'number' ? bundle.roundIndex : index,
            questions,
            answers:
              bundle.answers !== undefined && typeof bundle.answers === 'object' && bundle.answers !== null
                ? { ...(bundle.answers as Record<string, string>) }
                : {},
            answerNotes:
              bundle.answerNotes !== undefined && typeof bundle.answerNotes === 'object' && bundle.answerNotes !== null
                ? { ...(bundle.answerNotes as Record<string, string>) }
                : {},
            guidance: typeof bundle.guidance === 'string' || bundle.guidance === null ? bundle.guidance : null,
          },
        ];
      })
    : [];
  let activeRound: ActiveGuidedRound | null = null;
  if (parsed.activeRound !== null && parsed.activeRound !== undefined && typeof parsed.activeRound === 'object') {
    const questions = normalizeDiagnosticQuestionBlocks(parsed.activeRound.questions);
    if (questions.length === 0) {
      activeRound = null;
    } else {
      const stepCap = Math.max(0, questions.length - 1);
      const answers =
        parsed.activeRound.answers !== undefined && typeof parsed.activeRound.answers === 'object'
          ? { ...parsed.activeRound.answers }
          : {};
      const answerNotes =
        parsed.activeRound.answerNotes !== undefined && typeof parsed.activeRound.answerNotes === 'object'
          ? { ...parsed.activeRound.answerNotes }
          : {};
      activeRound = {
        roundIndex: typeof parsed.activeRound.roundIndex === 'number' ? parsed.activeRound.roundIndex : 0,
        questions,
        answers,
        answerNotes,
        stepIndex: Math.min(Math.max(parsed.activeRound.stepIndex ?? 0, 0), stepCap),
        guidance:
          typeof parsed.activeRound.guidance === 'string' || parsed.activeRound.guidance === null
            ? parsed.activeRound.guidance
            : null,
      };
    }
  }
  let outcome: GuidedDiagnosticOutcome | null = parsed.outcome ?? null;
  if (outcome !== null && (typeof outcome.mappedSituation !== 'string' || typeof outcome.advisorSummary !== 'string')) {
    outcome = null;
  }
  return {
    version: 1,
    initialPrompt: typeof parsed.initialPrompt === 'string' ? parsed.initialPrompt : '',
    completedBundles: bundles,
    activeRound,
    outcome,
  };
}

export function parseGuidedDiagnosticJson(raw: string | undefined): GuidedDiagnosticV1 | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as GuidedDiagnosticV1;
    if (parsed.version !== 1 || typeof parsed.initialPrompt !== 'string') {
      return null;
    }
    return normalizeGuidedDiagnostic(parsed);
  } catch {
    return null;
  }
}

/**
 * Back navigation: within round, previous round, prompt, or from summary to last answered question.
 */
export function applyGuidedGoBack(state: GuidedDiagnosticV1): GuidedDiagnosticV1 {
  if (state.outcome !== null) {
    const bundles = [...state.completedBundles];
    const last = bundles.pop();
    if (last === undefined) {
      return { ...state, outcome: null };
    }
    const lastStep = Math.max(0, last.questions.length - 1);
    return {
      ...state,
      outcome: null,
      completedBundles: bundles,
      activeRound: {
        roundIndex: last.roundIndex,
        questions: last.questions,
        answers: { ...last.answers },
        answerNotes: { ...last.answerNotes },
        stepIndex: lastStep,
        guidance: last.guidance,
      },
    };
  }
  if (state.activeRound === null) {
    return state;
  }
  const activeRound = state.activeRound;
  if (activeRound.stepIndex > 0) {
    return {
      ...state,
      activeRound: {
        ...activeRound,
        stepIndex: activeRound.stepIndex - 1,
      },
    };
  }
  if (activeRound.roundIndex === 0) {
    return {
      ...state,
      activeRound: null,
      completedBundles: [],
    };
  }
  const bundles = [...state.completedBundles];
  const previous = bundles.pop();
  if (previous === undefined) {
    return state;
  }
  const lastStep = Math.max(0, previous.questions.length - 1);
  return {
    ...state,
    completedBundles: bundles,
    activeRound: {
      roundIndex: previous.roundIndex,
      questions: previous.questions,
      answers: { ...previous.answers },
      answerNotes: { ...previous.answerNotes },
      stepIndex: lastStep,
      guidance: previous.guidance,
    },
  };
}

export function toApiRoundsFromBundles(bundles: readonly CompletedRoundBundle[]): DiagnosticThreadRound[] {
  return bundles.map((bundle, index) => ({
    roundIndex: index,
    qa: bundle.questions.map((question) => ({
      questionId: question.id,
      question: question.prompt,
      answer: formatGuidedQuestionAnswer(
        bundle.answers[question.id] ?? '',
        bundle.answerNotes[question.id] ?? '',
      ),
    })),
  }));
}

export type DiagnosticTranscriptQa = {
  readonly question: string;
  readonly description: string | null;
  readonly answer: string;
};

export type DiagnosticTranscriptRound = {
  readonly roundIndex: number;
  readonly guidance: string | null;
  readonly items: readonly DiagnosticTranscriptQa[];
};

export type DiagnosticTranscript = {
  readonly initialPrompt: string;
  readonly rounds: readonly DiagnosticTranscriptRound[];
};

/**
 * Full user-facing transcript: free-text prompt plus every guided question and selected answer, grouped by round.
 */
export function buildDiagnosticTranscript(state: GuidedDiagnosticV1): DiagnosticTranscript {
  const rounds: DiagnosticTranscriptRound[] = state.completedBundles.map((bundle) => ({
    roundIndex: bundle.roundIndex,
    guidance: bundle.guidance,
    items: bundle.questions.map((question) => ({
      question: question.prompt,
      description: question.description,
      answer: formatGuidedQuestionAnswer(
        bundle.answers[question.id] ?? '',
        bundle.answerNotes[question.id] ?? '',
      ),
    })),
  }));
  return {
    initialPrompt: state.initialPrompt,
    rounds,
  };
}

/**
 * Monotonic step index for session.currentStep: 0 = prompt, then each question +1, summary = 1 + total questions.
 */
export function computeGuidedLinearStep(state: GuidedDiagnosticV1): number {
  const completedQuestionCount = state.completedBundles.reduce((acc, bundle) => acc + bundle.questions.length, 0);
  if (state.outcome !== null) {
    return 1 + completedQuestionCount;
  }
  if (state.activeRound !== null) {
    return 1 + completedQuestionCount + state.activeRound.stepIndex;
  }
  return 0;
}

export function buildDiagnosticThreadJson(state: GuidedDiagnosticV1): string {
  const rounds = toApiRoundsFromBundles(state.completedBundles);
  if (state.activeRound !== null) {
    const activeRound = state.activeRound;
    const qa = activeRound.questions.map((question) => ({
      questionId: question.id,
      question: question.prompt,
      answer: formatGuidedQuestionAnswer(
        activeRound.answers[question.id] ?? '',
        activeRound.answerNotes[question.id] ?? '',
      ),
    }));
    rounds.push({
      roundIndex: rounds.length,
      qa,
    });
  }
  return JSON.stringify({
    initialPrompt: state.initialPrompt,
    rounds,
    mappedSituation: state.outcome?.mappedSituation ?? null,
    advisorSummary: state.outcome?.advisorSummary ?? null,
  });
}
