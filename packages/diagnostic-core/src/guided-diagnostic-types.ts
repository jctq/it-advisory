export type DiagnosticSelectionMode = 'single' | 'multiple';

export type DiagnosticQuestionType = 'multiple-choice' | 'nested-options' | 'ranked-options';

export type DiagnosticVisibilityMatchMode = 'any' | 'all';

export type DiagnosticVisibilityRule = {
  readonly sourceQuestionId: string;
  readonly optionIds: readonly string[];
  readonly match: DiagnosticVisibilityMatchMode;
} | null;

export type DiagnosticOptionPresentation = {
  readonly icon: string | null;
  readonly badgeText: string | null;
  readonly eyebrow: string | null;
  readonly title: string | null;
  readonly supportingText: string | null;
  readonly exampleBullets: readonly string[];
  readonly panelTitle: string | null;
};

export type DiagnosticChildQuestionOption = {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
};

export type DiagnosticChildQuestionBlock = {
  readonly id: string;
  readonly prompt: string;
  readonly description: string | null;
  readonly selectionMode: DiagnosticSelectionMode;
  readonly options: readonly DiagnosticChildQuestionOption[];
};

export type DiagnosticQuestionOption = {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly showWhen: DiagnosticVisibilityRule;
  readonly presentation: DiagnosticOptionPresentation;
  readonly childQuestion: DiagnosticChildQuestionBlock | null;
};

/**
 * Persisted guided quiz (replaces static QUIZ_STEPS). Stored as answers.guidedDiagnostic JSON.
 */
export type DiagnosticQuestionBlock = {
  readonly id: string;
  readonly prompt: string;
  readonly description: string | null;
  readonly showWhen: DiagnosticVisibilityRule;
  readonly type: DiagnosticQuestionType;
  readonly rankedOptionLimit: number | null;
  readonly selectionMode: DiagnosticSelectionMode;
  readonly options: readonly DiagnosticQuestionOption[];
};

export type DiagnosticQuestionSelection = {
  readonly selectedOptionIds: readonly string[];
  readonly childSelections: Readonly<Record<string, readonly string[]>>;
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
  readonly roundTitle: string;
  readonly questions: readonly DiagnosticQuestionBlock[];
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
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
  readonly roundTitle: string;
  readonly questions: readonly DiagnosticQuestionBlock[];
  readonly answers: Record<string, DiagnosticQuestionSelection>;
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

export type DiagnosticQuestionValidationResult = {
  readonly isValid: boolean;
  readonly message: string | null;
};

export type PrunedDiagnosticAnswers = {
  readonly answers: Record<string, DiagnosticQuestionSelection>;
  readonly answerNotes: Record<string, string>;
  readonly hiddenQuestionIds: readonly string[];
};

export const GUIDED_DIAGNOSTIC_EMPTY: GuidedDiagnosticV1 = {
  version: 1,
  initialPrompt: '',
  completedBundles: [],
  activeRound: null,
  outcome: null,
};

export function createEmptyDiagnosticQuestionSelection(): DiagnosticQuestionSelection {
  return {
    selectedOptionIds: [],
    childSelections: {},
  };
}

function uniqueOptionIdsByQuestionOrder(
  question: DiagnosticQuestionBlock,
  optionIds: readonly string[],
): readonly string[] {
  const optionIdLookup = new Set(optionIds);
  return question.options.flatMap((option) => (optionIdLookup.has(option.id) ? [option.id] : []));
}

function buildSingleSelectCascadePath(params: {
  readonly currentSelection: DiagnosticQuestionSelection;
  readonly optionId: string;
  readonly question: DiagnosticQuestionBlock;
  readonly visitedOptionIds?: ReadonlySet<string>;
}): readonly string[] {
  const option = findQuestionOption(params.question, params.optionId);
  if (option === undefined) {
    return [];
  }
  const nextVisitedOptionIds = new Set(params.visitedOptionIds ?? []);
  if (nextVisitedOptionIds.has(option.id)) {
    return [];
  }
  nextVisitedOptionIds.add(option.id);
  if (option.showWhen === null || option.showWhen.sourceQuestionId !== params.question.id) {
    return [option.id];
  }
  const dependencyOptionIds =
    option.showWhen.match === 'all'
      ? option.showWhen.optionIds
      : params.currentSelection.selectedOptionIds.filter((selectedOptionId) =>
          option.showWhen?.optionIds.includes(selectedOptionId),
        );
  const resolvedDependencyOptionIds =
    dependencyOptionIds.length > 0 ? dependencyOptionIds : option.showWhen.optionIds.slice(0, 1);
  return uniqueOptionIdsByQuestionOrder(params.question, [
    ...resolvedDependencyOptionIds.flatMap((dependencyOptionId) =>
      buildSingleSelectCascadePath({
        question: params.question,
        currentSelection: params.currentSelection,
        optionId: dependencyOptionId,
        visitedOptionIds: nextVisitedOptionIds,
      }),
    ),
    option.id,
  ]);
}

function createEmptyDiagnosticOptionPresentation(): DiagnosticOptionPresentation {
  return {
    icon: null,
    badgeText: null,
    eyebrow: null,
    title: null,
    supportingText: null,
    exampleBullets: [],
    panelTitle: null,
  };
}

export function toggleQuestionOptionSelection(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
  readonly optionId: string;
}): DiagnosticQuestionSelection {
  const currentSelection = params.selection ?? createEmptyDiagnosticQuestionSelection();
  const isSelected = currentSelection.selectedOptionIds.includes(params.optionId);
  if (params.question.selectionMode === 'single') {
    const selectedOptionIds = buildSingleSelectCascadePath({
      question: params.question,
      currentSelection,
      optionId: params.optionId,
    });
    const nextChildSelections = Object.fromEntries(
      Object.entries(currentSelection.childSelections).filter(([optionId]) => selectedOptionIds.includes(optionId)),
    );
    return pruneQuestionOptionSelection({
      baseAnswers: params.baseAnswers,
      question: params.question,
      selection: {
        selectedOptionIds,
        childSelections: nextChildSelections,
      },
    });
  }
  if (isSelected) {
    const { [params.optionId]: _removed, ...remainingChildSelections } = currentSelection.childSelections;
    return pruneQuestionOptionSelection({
      baseAnswers: params.baseAnswers,
      question: params.question,
      selection: {
      selectedOptionIds: currentSelection.selectedOptionIds.filter((candidateId) => candidateId !== params.optionId),
      childSelections: remainingChildSelections,
      },
    });
  }
  return pruneQuestionOptionSelection({
    baseAnswers: params.baseAnswers,
    question: params.question,
    selection: {
    selectedOptionIds: [...currentSelection.selectedOptionIds, params.optionId],
    childSelections: currentSelection.childSelections,
    },
  });
}

export function toggleChildQuestionOptionSelection(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
  readonly parentOptionId: string;
  readonly childOptionId: string;
}): DiagnosticQuestionSelection {
  const currentSelection = params.selection ?? createEmptyDiagnosticQuestionSelection();
  if (!currentSelection.selectedOptionIds.includes(params.parentOptionId)) {
    return currentSelection;
  }
  const parentOption = findQuestionOption(params.question, params.parentOptionId);
  if (parentOption === undefined || parentOption.childQuestion === null) {
    return currentSelection;
  }
  const currentChildOptionIds = currentSelection.childSelections[params.parentOptionId] ?? [];
  const isSelected = currentChildOptionIds.includes(params.childOptionId);
  const nextChildOptionIds =
    parentOption.childQuestion.selectionMode === 'single'
      ? [params.childOptionId]
      : isSelected
        ? currentChildOptionIds.filter((candidateId) => candidateId !== params.childOptionId)
        : [...currentChildOptionIds, params.childOptionId];
  const nextChildSelections =
    nextChildOptionIds.length === 0
      ? Object.fromEntries(
          Object.entries(currentSelection.childSelections).filter(([parentOptionId]) => parentOptionId !== params.parentOptionId),
        )
      : {
          ...currentSelection.childSelections,
          [params.parentOptionId]: nextChildOptionIds,
        };
  return pruneQuestionOptionSelection({
    baseAnswers: params.baseAnswers,
    question: params.question,
    selection: {
    selectedOptionIds: currentSelection.selectedOptionIds,
    childSelections: nextChildSelections,
    },
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildDiagnosticOptionKey(value: string): string {
  return value.toLowerCase();
}

function normalizeSelectionMode(value: unknown): DiagnosticSelectionMode {
  return value === 'multiple' ? 'multiple' : 'single';
}

function normalizeQuestionType(value: unknown): DiagnosticQuestionType {
  if (value === 'nested-options' || value === 'ranked-options') {
    return value;
  }
  return 'multiple-choice';
}

function normalizeVisibilityMatchMode(value: unknown): DiagnosticVisibilityMatchMode {
  return value === 'all' ? 'all' : 'any';
}

function normalizeVisibilityRule(input: unknown): DiagnosticVisibilityRule {
  if (input === null || input === undefined || typeof input !== 'object') {
    return null;
  }
  const rule = input as {
    readonly match?: unknown;
    readonly optionIds?: unknown;
    readonly sourceQuestionId?: unknown;
  };
  if (!isNonEmptyString(rule.sourceQuestionId) || !Array.isArray(rule.optionIds)) {
    return null;
  }
  const optionIds = rule.optionIds
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .map((candidate) => normalizeText(candidate))
    .filter((candidate, index, values) => candidate.length > 0 && values.indexOf(candidate) === index);
  if (optionIds.length === 0) {
    return null;
  }
  return {
    sourceQuestionId: normalizeText(rule.sourceQuestionId),
    optionIds,
    match: normalizeVisibilityMatchMode(rule.match),
  };
}

function normalizeRankedOptionLimit(value: unknown, questionType: DiagnosticQuestionType): number | null {
  if (questionType !== 'ranked-options') {
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 2) {
    return value;
  }
  return 3;
}

function buildNormalizedId(value: unknown, fallbackPrefix: string, index: number): string {
  if (isNonEmptyString(value)) {
    return normalizeText(value);
  }
  return `${fallbackPrefix}-${index + 1}`;
}

function findQuestionOption(question: DiagnosticQuestionBlock, optionId: string): DiagnosticQuestionOption | undefined {
  return question.options.find((option) => option.id === optionId);
}

function findQuestionOptionByLegacyValue(
  question: DiagnosticQuestionBlock,
  candidateValue: string,
): DiagnosticQuestionOption | undefined {
  const normalizedCandidateValue = candidateValue.trim().toLowerCase();
  return question.options.find(
    (option) =>
      option.id.toLowerCase() === normalizedCandidateValue || option.label.trim().toLowerCase() === normalizedCandidateValue,
  );
}

function findChildOptionByLegacyValue(
  childQuestion: DiagnosticChildQuestionBlock,
  candidateValue: string,
): DiagnosticChildQuestionOption | undefined {
  const normalizedCandidateValue = candidateValue.trim().toLowerCase();
  return childQuestion.options.find(
    (option) =>
      option.id.toLowerCase() === normalizedCandidateValue || option.label.trim().toLowerCase() === normalizedCandidateValue,
  );
}

function normalizeChildQuestionOptions(
  input: readonly unknown[],
  optionId: string,
): DiagnosticChildQuestionOption[] {
  const seen = new Set<string>();
  return input.flatMap((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }
    const option = candidate as {
      readonly description?: unknown;
      readonly id?: unknown;
      readonly label?: unknown;
    };
    if (!isNonEmptyString(option.label)) {
      return [];
    }
    const label = normalizeText(option.label);
    const key = buildDiagnosticOptionKey(label);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    const description = typeof option.description === 'string' ? normalizeText(option.description) : '';
    return [
      {
        id: buildNormalizedId(option.id, `${optionId}-child-option`, index),
        label,
        description: description.length > 0 ? description : null,
      },
    ];
  });
}

function normalizeOptionPresentation(input: unknown): DiagnosticOptionPresentation {
  if (input === null || typeof input !== 'object') {
    return createEmptyDiagnosticOptionPresentation();
  }
  const presentation = input as {
    readonly icon?: unknown;
    readonly badgeText?: unknown;
    readonly eyebrow?: unknown;
    readonly title?: unknown;
    readonly supportingText?: unknown;
    readonly exampleBullets?: unknown;
    readonly panelTitle?: unknown;
  };
  const exampleBullets = Array.isArray(presentation.exampleBullets)
    ? presentation.exampleBullets
        .filter((candidate): candidate is string => typeof candidate === 'string')
        .map((candidate) => normalizeText(candidate))
        .filter((candidate) => candidate.length > 0)
    : [];
  return {
    icon: typeof presentation.icon === 'string' ? normalizeText(presentation.icon) : null,
    badgeText: typeof presentation.badgeText === 'string' ? normalizeText(presentation.badgeText) : null,
    eyebrow: typeof presentation.eyebrow === 'string' ? normalizeText(presentation.eyebrow) : null,
    title: typeof presentation.title === 'string' ? normalizeText(presentation.title) : null,
    supportingText: typeof presentation.supportingText === 'string' ? normalizeText(presentation.supportingText) : null,
    exampleBullets,
    panelTitle: typeof presentation.panelTitle === 'string' ? normalizeText(presentation.panelTitle) : null,
  };
}

function normalizeChildQuestion(input: unknown, optionId: string): DiagnosticChildQuestionBlock | null {
  if (input === null || typeof input !== 'object') {
    return null;
  }
  const childQuestion = input as {
    readonly description?: unknown;
    readonly id?: unknown;
    readonly options?: unknown;
    readonly prompt?: unknown;
    readonly selectionMode?: unknown;
  };
  if (!isNonEmptyString(childQuestion.prompt) || !Array.isArray(childQuestion.options)) {
    return null;
  }
  const options = normalizeChildQuestionOptions(childQuestion.options, optionId);
  if (options.length === 0) {
    return null;
  }
  const description = typeof childQuestion.description === 'string' ? normalizeText(childQuestion.description) : '';
  return {
    id: buildNormalizedId(childQuestion.id, `${optionId}-child-question`, 0),
    prompt: normalizeText(childQuestion.prompt),
    description: description.length > 0 ? description : null,
    selectionMode: normalizeSelectionMode(childQuestion.selectionMode),
    options,
  };
}

/**
 * Trims diagnostic options and removes duplicate labels while preserving order.
 */
export function normalizeDiagnosticOptions(input: readonly unknown[]): DiagnosticQuestionOption[] {
  const seen = new Set<string>();
  return input.flatMap((candidate, index) => {
    if (isNonEmptyString(candidate)) {
      const label = normalizeText(candidate);
      const key = buildDiagnosticOptionKey(label);
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [
        {
          id: `option-${index + 1}`,
          label,
          description: null,
          showWhen: null,
          presentation: createEmptyDiagnosticOptionPresentation(),
          childQuestion: null,
        },
      ];
    }
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }
    const option = candidate as {
      readonly childQuestion?: unknown;
      readonly description?: unknown;
      readonly id?: unknown;
      readonly label?: unknown;
      readonly presentation?: unknown;
      readonly showWhen?: unknown;
    };
    if (!isNonEmptyString(option.label)) {
      return [];
    }
    const label = normalizeText(option.label);
    const key = buildDiagnosticOptionKey(label);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    const normalizedOptionId = buildNormalizedId(option.id, 'option', index);
    const description = typeof option.description === 'string' ? normalizeText(option.description) : '';
    return [
      {
        id: normalizedOptionId,
        label,
        description: description.length > 0 ? description : null,
        showWhen: normalizeVisibilityRule(option.showWhen),
        presentation: normalizeOptionPresentation(option.presentation),
        childQuestion: normalizeChildQuestion(option.childQuestion, normalizedOptionId),
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
      readonly rankedOptionLimit?: unknown;
      readonly selectionMode?: unknown;
      readonly type?: unknown;
    };
    if (!isNonEmptyString(question.prompt)) {
      return [];
    }
    const options = normalizeQuestionOptions(question.options);
    if (options.length === 0) {
      return [];
    }
    const description = typeof question.description === 'string' ? normalizeText(question.description) : '';
    const questionType = normalizeQuestionType(question.type);
    return [
      {
        id: isNonEmptyString(question.id) ? normalizeText(question.id) : `question-${index + 1}`,
        prompt: normalizeText(question.prompt),
        description: description.length > 0 ? description : null,
        showWhen: normalizeVisibilityRule((question as { readonly showWhen?: unknown }).showWhen),
        type: questionType,
        rankedOptionLimit: normalizeRankedOptionLimit(question.rankedOptionLimit, questionType),
        selectionMode: questionType === 'ranked-options' ? 'multiple' : normalizeSelectionMode(question.selectionMode),
        options,
      },
    ];
  });
}

function normalizeOptionIds(
  input: unknown,
  question: DiagnosticQuestionBlock,
): readonly string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  return input.flatMap((candidate) => {
    if (!isNonEmptyString(candidate)) {
      return [];
    }
    const matchedOption = findQuestionOptionByLegacyValue(question, candidate);
    if (matchedOption === undefined || seen.has(matchedOption.id)) {
      return [];
    }
    seen.add(matchedOption.id);
    return [matchedOption.id];
  });
}

function normalizeChildSelectionIds(
  input: unknown,
  childQuestion: DiagnosticChildQuestionBlock,
): readonly string[] {
  if (Array.isArray(input)) {
    const seen = new Set<string>();
    return input.flatMap((candidate) => {
      if (!isNonEmptyString(candidate)) {
        return [];
      }
      const matchedOption = findChildOptionByLegacyValue(childQuestion, candidate);
      if (matchedOption === undefined || seen.has(matchedOption.id)) {
        return [];
      }
      seen.add(matchedOption.id);
      return [matchedOption.id];
    });
  }
  if (isNonEmptyString(input)) {
    const matchedOption = findChildOptionByLegacyValue(childQuestion, input);
    return matchedOption === undefined ? [] : [matchedOption.id];
  }
  return [];
}

function normalizeChildSelections(
  input: unknown,
  question: DiagnosticQuestionBlock,
): Readonly<Record<string, readonly string[]>> {
  if (input === null || typeof input !== 'object') {
    return {};
  }
  const childSelectionsEntries = Object.entries(input as Record<string, unknown>).flatMap(([rawParentId, rawSelection]) => {
    const parentOption = findQuestionOptionByLegacyValue(question, rawParentId);
    if (parentOption === undefined || parentOption.childQuestion === null) {
      return [];
    }
    const normalizedSelectionIds = normalizeChildSelectionIds(rawSelection, parentOption.childQuestion);
    return normalizedSelectionIds.length === 0 ? [] : [[parentOption.id, normalizedSelectionIds] as const];
  });
  return Object.fromEntries(childSelectionsEntries);
}

function normalizeQuestionSelection(
  input: unknown,
  baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>> | undefined,
  question: DiagnosticQuestionBlock,
): DiagnosticQuestionSelection {
  if (isNonEmptyString(input)) {
    const matchedOption = findQuestionOptionByLegacyValue(question, input);
    if (matchedOption === undefined) {
      return createEmptyDiagnosticQuestionSelection();
    }
    return pruneQuestionOptionSelection({
      baseAnswers,
      question,
      selection: {
      selectedOptionIds: [matchedOption.id],
      childSelections: {},
      },
    });
  }
  if (Array.isArray(input)) {
    return pruneQuestionOptionSelection({
      baseAnswers,
      question,
      selection: {
      selectedOptionIds: normalizeOptionIds(input, question),
      childSelections: {},
      },
    });
  }
  if (input === null || typeof input !== 'object') {
    return createEmptyDiagnosticQuestionSelection();
  }
  const selection = input as {
    readonly childSelections?: unknown;
    readonly selectedOptionIds?: unknown;
    readonly selectedOptions?: unknown;
  };
  const selectedOptionIds = Array.isArray(selection.selectedOptionIds)
    ? normalizeOptionIds(selection.selectedOptionIds, question)
    : Array.isArray(selection.selectedOptions)
      ? normalizeOptionIds(selection.selectedOptions, question)
      : [];
  const childSelections = normalizeChildSelections(selection.childSelections, question);
  return pruneQuestionOptionSelection({
    baseAnswers,
    question,
    selection: {
      selectedOptionIds,
      childSelections,
    },
  });
}

function normalizeQuestionAnswers(
  baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>> | undefined,
  input: unknown,
  questions: readonly DiagnosticQuestionBlock[],
): Record<string, DiagnosticQuestionSelection> {
  if (input === null || typeof input !== 'object') {
    return {};
  }
  const candidateAnswers = input as Record<string, unknown>;
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      normalizeQuestionSelection(candidateAnswers[question.id], baseAnswers, question),
    ]),
  );
}

function normalizeAnswerNotes(input: unknown): Record<string, string> {
  if (input === null || typeof input !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).flatMap(([questionId, value]) => {
      if (!isNonEmptyString(questionId) || typeof value !== 'string') {
        return [];
      }
      return [[questionId, value]];
    }),
  );
}

export function buildDiagnosticAnswerLookup(params: {
  readonly activeRound?: ActiveGuidedRound | null;
  readonly completedBundles: readonly CompletedRoundBundle[];
}): Readonly<Record<string, DiagnosticQuestionSelection>> {
  const bundleEntries = params.completedBundles.flatMap((bundle) => Object.entries(bundle.answers));
  const activeEntries =
    params.activeRound === undefined || params.activeRound === null ? [] : Object.entries(params.activeRound.answers);
  return Object.fromEntries([...bundleEntries, ...activeEntries]);
}

export function isVisibilityRuleMatched(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly rule: DiagnosticVisibilityRule;
}): boolean {
  if (params.rule === null) {
    return true;
  }
  const sourceSelection = params.answers[params.rule.sourceQuestionId];
  if (sourceSelection === undefined || sourceSelection.selectedOptionIds.length === 0) {
    return false;
  }
  if (params.rule.match === 'all') {
    return params.rule.optionIds.every((optionId) => sourceSelection.selectedOptionIds.includes(optionId));
  }
  return params.rule.optionIds.some((optionId) => sourceSelection.selectedOptionIds.includes(optionId));
}

export function isQuestionVisible(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
}): boolean {
  return isVisibilityRuleMatched({
    answers: params.answers,
    rule: params.question.showWhen,
  });
}

function isOptionRuleMatchedBySelectedIds(params: {
  readonly questionId: string;
  readonly rule: DiagnosticVisibilityRule;
  readonly selectedOptionIds: readonly string[];
}): boolean {
  if (params.rule === null) {
    return true;
  }
  if (params.rule.sourceQuestionId !== params.questionId) {
    return false;
  }
  if (params.rule.match === 'all') {
    return params.rule.optionIds.every((optionId) => params.selectedOptionIds.includes(optionId));
  }
  return params.rule.optionIds.some((optionId) => params.selectedOptionIds.includes(optionId));
}

export function getVisibleQuestionOptions(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
}): readonly DiagnosticQuestionOption[] {
  const currentSelection = params.selection ?? createEmptyDiagnosticQuestionSelection();
  const visibilityAnswers = buildVisibilityAnswers({
    answers: {
      [params.question.id]: currentSelection,
    },
    baseAnswers: params.baseAnswers,
  });
  const visibleOptions: DiagnosticQuestionOption[] = [];
  const selectedVisibleOptionIds: string[] = [];
  for (const option of params.question.options) {
    const isVisible =
      option.showWhen !== null && option.showWhen.sourceQuestionId !== params.question.id
        ? isVisibilityRuleMatched({
            answers: visibilityAnswers,
            rule: option.showWhen,
          })
        : isOptionRuleMatchedBySelectedIds({
            questionId: params.question.id,
            rule: option.showWhen,
            selectedOptionIds: selectedVisibleOptionIds,
          });
    if (!isVisible) {
      continue;
    }
    visibleOptions.push(option);
    if (currentSelection.selectedOptionIds.includes(option.id)) {
      selectedVisibleOptionIds.push(option.id);
    }
  }
  return visibleOptions;
}

export function isQuestionOptionVisible(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly option: DiagnosticQuestionOption;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
}): boolean {
  return getVisibleQuestionOptions({
    baseAnswers: params.baseAnswers,
    question: params.question,
    selection: params.selection,
  }).some((option) => option.id === params.option.id);
}

export function pruneQuestionOptionSelection(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
}): DiagnosticQuestionSelection {
  const currentSelection = params.selection ?? createEmptyDiagnosticQuestionSelection();
  const visibleOptions = getVisibleQuestionOptions({
    baseAnswers: params.baseAnswers,
    question: params.question,
    selection: currentSelection,
  });
  const visibleOptionIds = new Set(visibleOptions.map((option) => option.id));
  const selectedOptionIds = currentSelection.selectedOptionIds.filter((optionId) => visibleOptionIds.has(optionId));
  const childSelections = Object.fromEntries(
    Object.entries(currentSelection.childSelections).filter(([optionId]) => selectedOptionIds.includes(optionId)),
  );
  return {
    selectedOptionIds,
    childSelections,
  };
}

export function getEffectiveSelectedOptionIds(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
}): readonly string[] {
  const prunedSelection = pruneQuestionOptionSelection(params);
  if (params.question.selectionMode !== 'single') {
    return prunedSelection.selectedOptionIds;
  }
  const lastSelectedOptionId = prunedSelection.selectedOptionIds[prunedSelection.selectedOptionIds.length - 1];
  return lastSelectedOptionId === undefined ? [] : [lastSelectedOptionId];
}

function buildVisibilityAnswers(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
}): Readonly<Record<string, DiagnosticQuestionSelection>> {
  if (params.baseAnswers === undefined) {
    return params.answers;
  }
  return {
    ...params.baseAnswers,
    ...params.answers,
  };
}

export function getVisibleQuestionIndexes(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): readonly number[] {
  const visibilityAnswers = buildVisibilityAnswers({
    answers: params.answers,
    baseAnswers: params.baseAnswers,
  });
  return params.questions.flatMap((question, questionIndex) =>
    isQuestionVisible({
      answers: visibilityAnswers,
      question,
    })
      ? [questionIndex]
      : [],
  );
}

export function findNextVisibleQuestionIndex(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly currentIndex: number;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): number | null {
  const visibilityAnswers = buildVisibilityAnswers({
    answers: params.answers,
    baseAnswers: params.baseAnswers,
  });
  for (let questionIndex = params.currentIndex + 1; questionIndex < params.questions.length; questionIndex += 1) {
    const question = params.questions[questionIndex];
    if (
      question !== undefined &&
      isQuestionVisible({
        answers: visibilityAnswers,
        question,
      })
    ) {
      return questionIndex;
    }
  }
  return null;
}

export function findPreviousVisibleQuestionIndex(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly currentIndex: number;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): number | null {
  const visibilityAnswers = buildVisibilityAnswers({
    answers: params.answers,
    baseAnswers: params.baseAnswers,
  });
  for (let questionIndex = params.currentIndex - 1; questionIndex >= 0; questionIndex -= 1) {
    const question = params.questions[questionIndex];
    if (
      question !== undefined &&
      isQuestionVisible({
        answers: visibilityAnswers,
        question,
      })
    ) {
      return questionIndex;
    }
  }
  return null;
}

export function findFirstVisibleQuestionIndex(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): number | null {
  return getVisibleQuestionIndexes(params)[0] ?? null;
}

export function pruneHiddenAnswers(params: {
  readonly answerNotes: Readonly<Record<string, string>>;
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): PrunedDiagnosticAnswers {
  const nextAnswers: Record<string, DiagnosticQuestionSelection> = {};
  const nextAnswerNotes: Record<string, string> = {};
  const hiddenQuestionIds: string[] = [];
  for (const question of params.questions) {
    const visibilityAnswers = buildVisibilityAnswers({
      answers: nextAnswers,
      baseAnswers: params.baseAnswers,
    });
    const isVisible = isQuestionVisible({
      answers: visibilityAnswers,
      question,
    });
    if (!isVisible) {
      hiddenQuestionIds.push(question.id);
      continue;
    }
    const selection = params.answers[question.id];
    if (selection !== undefined) {
      nextAnswers[question.id] = pruneQuestionOptionSelection({
        question,
        selection,
        baseAnswers: visibilityAnswers,
      });
    }
    const answerNote = params.answerNotes[question.id];
    if (answerNote !== undefined) {
      nextAnswerNotes[question.id] = answerNote;
    }
  }
  return {
    answers: nextAnswers,
    answerNotes: nextAnswerNotes,
    hiddenQuestionIds,
  };
}

function resolveVisibleStepIndex(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly questions: readonly DiagnosticQuestionBlock[];
  readonly requestedStepIndex: number;
}): number {
  const visibleIndexes = getVisibleQuestionIndexes(params);
  if (visibleIndexes.length === 0) {
    return 0;
  }
  const boundedStepIndex = Math.min(Math.max(params.requestedStepIndex, 0), params.questions.length - 1);
  if (visibleIndexes.includes(boundedStepIndex)) {
    return boundedStepIndex;
  }
  const nextVisibleIndex = visibleIndexes.find((questionIndex) => questionIndex >= boundedStepIndex);
  return nextVisibleIndex ?? visibleIndexes[visibleIndexes.length - 1] ?? 0;
}

function countVisibleQuestions(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): number {
  return getVisibleQuestionIndexes(params).length;
}

function buildVisibleQuestionList(params: {
  readonly answers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly questions: readonly DiagnosticQuestionBlock[];
}): readonly DiagnosticQuestionBlock[] {
  const visibleIndexes = getVisibleQuestionIndexes(params);
  return visibleIndexes.flatMap((questionIndex) => {
    const question = params.questions[questionIndex];
    return question === undefined ? [] : [question];
  });
}

function buildBundleAnswerLookup(bundles: readonly CompletedRoundBundle[]): Readonly<Record<string, DiagnosticQuestionSelection>> {
  return buildDiagnosticAnswerLookup({
    completedBundles: bundles,
  });
}

function buildSelectedOptionLabels(
  baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>> | undefined,
  question: DiagnosticQuestionBlock,
  selection: DiagnosticQuestionSelection,
): readonly string[] {
  const prunedSelection = pruneQuestionOptionSelection({
    baseAnswers,
    question,
    selection,
  });
  const selectedOptionIds =
    question.selectionMode === 'single'
      ? getEffectiveSelectedOptionIds({
          baseAnswers,
          question,
          selection: prunedSelection,
        })
      : prunedSelection.selectedOptionIds;
  return selectedOptionIds.flatMap((optionId) => {
    const option = findQuestionOption(question, optionId);
    if (option === undefined) {
      return [];
    }
    const childQuestion = option.childQuestion;
    if (childQuestion === null) {
      return [option.label];
    }
    const selectedChildOptionIds = selection.childSelections[option.id] ?? [];
    const selectedChildLabels = selectedChildOptionIds.flatMap((childOptionId) => {
      const childOption = childQuestion.options.find((candidateOption) => candidateOption.id === childOptionId);
      return childOption === undefined ? [] : [childOption.label];
    });
    if (selectedChildLabels.length === 0) {
      return [option.label];
    }
    return [`${option.label}: ${selectedChildLabels.join(', ')}`];
  });
}

/**
 * Combines structured multiple-choice selections and optional typed detail for API/thread payloads.
 */
export function formatGuidedQuestionAnswer(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
  readonly detailNote: string;
}): string {
  const selection = params.selection ?? createEmptyDiagnosticQuestionSelection();
  const selectedOptionLabels = buildSelectedOptionLabels(params.baseAnswers, params.question, selection);
  const trimmedNote = params.detailNote.trim();
  const flattenedSelection =
    params.question.type === 'ranked-options'
      ? selectedOptionLabels.map((label, index) => `${index + 1}. ${label}`).join('\n').trim()
      : selectedOptionLabels.join('\n').trim();
  if (flattenedSelection.length > 0 && trimmedNote.length > 0) {
    return `${flattenedSelection}\n\nExact answer: ${trimmedNote}`;
  }
  if (flattenedSelection.length > 0) {
    return flattenedSelection;
  }
  return trimmedNote;
}

export function validateGuidedQuestionResponse(params: {
  readonly baseAnswers?: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
  readonly detailNote: string;
}): DiagnosticQuestionValidationResult {
  const selection = pruneQuestionOptionSelection({
    baseAnswers: params.baseAnswers,
    question: params.question,
    selection: params.selection,
  });
  const trimmedDetailNote = params.detailNote.trim();
  if (selection.selectedOptionIds.length === 0 && trimmedDetailNote.length === 0) {
    return {
      isValid: false,
      message: 'Select an option or add a short note before continuing.',
    };
  }
  if (params.question.type === 'ranked-options') {
    const rankedOptionLimit = params.question.rankedOptionLimit ?? 3;
    if (
      getEffectiveSelectedOptionIds({
        baseAnswers: params.baseAnswers,
        question: params.question,
        selection,
      }).length !== rankedOptionLimit
    ) {
      return {
        isValid: false,
        message: `Rank exactly ${rankedOptionLimit} options before continuing.`,
      };
    }
  }
  const hasMissingChildSelections = getEffectiveSelectedOptionIds({
    baseAnswers: params.baseAnswers,
    question: params.question,
    selection,
  }).some((optionId) => {
    const option = findQuestionOption(params.question, optionId);
    if (option === undefined || option.childQuestion === null) {
      return false;
    }
    const selectedChildOptionIds = selection.childSelections[option.id] ?? [];
    return selectedChildOptionIds.length === 0;
  });
  if (hasMissingChildSelections) {
    return {
      isValid: false,
      message: 'Answer each follow-up option before continuing.',
    };
  }
  return {
    isValid: true,
    message: null,
  };
}

export function serializeGuidedDiagnostic(state: GuidedDiagnosticV1): string {
  return JSON.stringify(state);
}

function normalizeGuidedDiagnostic(parsed: GuidedDiagnosticV1): GuidedDiagnosticV1 {
  const bundles: CompletedRoundBundle[] = [];
  if (Array.isArray(parsed.completedBundles)) {
    for (const [bundleIndex, rawBundle] of parsed.completedBundles.entries()) {
      if (rawBundle === null || typeof rawBundle !== 'object') {
        continue;
      }
      const questions = normalizeDiagnosticQuestionBlocks(rawBundle.questions);
      if (questions.length === 0) {
        continue;
      }
      const priorAnswers = buildBundleAnswerLookup(bundles);
      const normalizedAnswers = normalizeQuestionAnswers(priorAnswers, rawBundle.answers, questions);
      const normalizedAnswerNotes = normalizeAnswerNotes(rawBundle.answerNotes);
      const prunedAnswers = pruneHiddenAnswers({
        questions,
        baseAnswers: priorAnswers,
        answers: normalizedAnswers,
        answerNotes: normalizedAnswerNotes,
      });
      bundles.push({
        roundIndex: typeof rawBundle.roundIndex === 'number' ? rawBundle.roundIndex : bundleIndex,
        roundTitle: isNonEmptyString((rawBundle as { readonly roundTitle?: unknown }).roundTitle)
          ? normalizeText((rawBundle as { readonly roundTitle: string }).roundTitle)
          : `Round ${bundleIndex + 1}`,
        questions: buildVisibleQuestionList({
          questions,
          baseAnswers: priorAnswers,
          answers: prunedAnswers.answers,
        }),
        answers: prunedAnswers.answers,
        answerNotes: prunedAnswers.answerNotes,
        guidance: typeof rawBundle.guidance === 'string' || rawBundle.guidance === null ? rawBundle.guidance : null,
      });
    }
  }
  let activeRound: ActiveGuidedRound | null = null;
  if (parsed.activeRound !== null && parsed.activeRound !== undefined && typeof parsed.activeRound === 'object') {
    const questions = normalizeDiagnosticQuestionBlocks(parsed.activeRound.questions);
    if (questions.length === 0) {
      activeRound = null;
    } else {
      const priorAnswers = buildBundleAnswerLookup(bundles);
      const normalizedAnswers = normalizeQuestionAnswers(priorAnswers, parsed.activeRound.answers, questions);
      const normalizedAnswerNotes = normalizeAnswerNotes(parsed.activeRound.answerNotes);
      const prunedAnswers = pruneHiddenAnswers({
        questions,
        baseAnswers: priorAnswers,
        answers: normalizedAnswers,
        answerNotes: normalizedAnswerNotes,
      });
      const visibleQuestionIndexes = getVisibleQuestionIndexes({
        questions,
        baseAnswers: priorAnswers,
        answers: prunedAnswers.answers,
      });
      if (visibleQuestionIndexes.length === 0) {
        activeRound = null;
      } else {
      activeRound = {
        roundIndex: typeof parsed.activeRound.roundIndex === 'number' ? parsed.activeRound.roundIndex : 0,
        roundTitle: isNonEmptyString((parsed.activeRound as { readonly roundTitle?: unknown }).roundTitle)
          ? normalizeText((parsed.activeRound as { readonly roundTitle: string }).roundTitle)
          : `Round ${typeof parsed.activeRound.roundIndex === 'number' ? parsed.activeRound.roundIndex + 1 : 1}`,
        questions,
        answers: prunedAnswers.answers,
        answerNotes: prunedAnswers.answerNotes,
        stepIndex: resolveVisibleStepIndex({
          questions,
          baseAnswers: priorAnswers,
          answers: prunedAnswers.answers,
          requestedStepIndex: parsed.activeRound.stepIndex ?? 0,
        }),
        guidance:
          typeof parsed.activeRound.guidance === 'string' || parsed.activeRound.guidance === null
            ? parsed.activeRound.guidance
            : null,
      };
      }
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
    if ((parsed as { readonly version?: unknown }).version !== 1 || typeof parsed.initialPrompt !== 'string') {
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
    const lastStep = resolveVisibleStepIndex({
      questions: last.questions,
      baseAnswers: buildBundleAnswerLookup(bundles),
      answers: last.answers,
      requestedStepIndex: last.questions.length - 1,
    });
    return {
      ...state,
      outcome: null,
      completedBundles: bundles,
      activeRound: {
        roundIndex: last.roundIndex,
        roundTitle: last.roundTitle,
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
  const previousVisibleQuestionIndex = findPreviousVisibleQuestionIndex({
    questions: activeRound.questions,
    baseAnswers: buildBundleAnswerLookup(state.completedBundles),
    answers: activeRound.answers,
    currentIndex: activeRound.stepIndex,
  });
  if (previousVisibleQuestionIndex !== null) {
    return {
      ...state,
      activeRound: {
        ...activeRound,
        stepIndex: previousVisibleQuestionIndex,
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
  const lastStep = resolveVisibleStepIndex({
    questions: previous.questions,
    baseAnswers: buildBundleAnswerLookup(bundles),
    answers: previous.answers,
    requestedStepIndex: previous.questions.length - 1,
  });
  return {
    ...state,
    completedBundles: bundles,
    activeRound: {
      roundIndex: previous.roundIndex,
      roundTitle: previous.roundTitle,
      questions: previous.questions,
      answers: { ...previous.answers },
      answerNotes: { ...previous.answerNotes },
      stepIndex: lastStep,
      guidance: previous.guidance,
    },
  };
}

export function toApiRoundsFromBundles(bundles: readonly CompletedRoundBundle[]): DiagnosticThreadRound[] {
  const rounds: DiagnosticThreadRound[] = [];
  const previousBundles: CompletedRoundBundle[] = [];
  for (const [bundleIndex, bundle] of bundles.entries()) {
    const visibleQuestions = buildVisibleQuestionList({
      questions: bundle.questions,
      baseAnswers: buildBundleAnswerLookup(previousBundles),
      answers: bundle.answers,
    });
    rounds.push({
      roundIndex: bundleIndex,
      qa: visibleQuestions.map((question) => ({
        questionId: question.id,
        question: question.prompt,
        answer: formatGuidedQuestionAnswer({
          baseAnswers: buildBundleAnswerLookup(previousBundles),
          question,
          selection: bundle.answers[question.id],
          detailNote: bundle.answerNotes[question.id] ?? '',
        }),
      })),
    });
    previousBundles.push(bundle);
  }
  return rounds;
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
  const rounds: DiagnosticTranscriptRound[] = [];
  const previousBundles: CompletedRoundBundle[] = [];
  for (const [bundleIndex, bundle] of state.completedBundles.entries()) {
    const visibleQuestions = buildVisibleQuestionList({
      questions: bundle.questions,
      baseAnswers: buildBundleAnswerLookup(previousBundles),
      answers: bundle.answers,
    });
    rounds.push({
      roundIndex: bundleIndex,
      guidance: bundle.guidance,
      items: visibleQuestions.map((question) => ({
        question: question.prompt,
        description: question.description,
        answer: formatGuidedQuestionAnswer({
          baseAnswers: buildBundleAnswerLookup(previousBundles),
          question,
          selection: bundle.answers[question.id],
          detailNote: bundle.answerNotes[question.id] ?? '',
        }),
      })),
    });
    previousBundles.push(bundle);
  }
  return {
    initialPrompt: state.initialPrompt,
    rounds,
  };
}

/**
 * Monotonic step index for session.currentStep: 0 = prompt, then each question +1, summary = 1 + total questions.
 */
export function computeGuidedLinearStep(state: GuidedDiagnosticV1): number {
  const completedQuestionCount = state.completedBundles.reduce((accumulator, bundle, bundleIndex) => {
    const priorBundles = state.completedBundles.slice(0, bundleIndex);
    return (
      accumulator +
      countVisibleQuestions({
        questions: bundle.questions,
        baseAnswers: buildBundleAnswerLookup(priorBundles),
        answers: bundle.answers,
      })
    );
  }, 0);
  if (state.outcome !== null) {
    return 1 + completedQuestionCount;
  }
  if (state.activeRound !== null) {
    const visibleQuestionIndexes = getVisibleQuestionIndexes({
      questions: state.activeRound.questions,
      baseAnswers: buildBundleAnswerLookup(state.completedBundles),
      answers: state.activeRound.answers,
    });
    const currentVisibleIndex = visibleQuestionIndexes.indexOf(state.activeRound.stepIndex);
    return 1 + completedQuestionCount + Math.max(currentVisibleIndex, 0);
  }
  return 0;
}

export function buildDiagnosticThreadJson(state: GuidedDiagnosticV1): string {
  const rounds = toApiRoundsFromBundles(state.completedBundles);
  if (state.activeRound !== null) {
    const activeRound = state.activeRound;
    const visibleQuestions = buildVisibleQuestionList({
      questions: activeRound.questions,
      baseAnswers: buildBundleAnswerLookup(state.completedBundles),
      answers: activeRound.answers,
    });
    const qa = visibleQuestions.map((question) => ({
      questionId: question.id,
      question: question.prompt,
      answer: formatGuidedQuestionAnswer({
        baseAnswers: buildBundleAnswerLookup(state.completedBundles),
        question,
        selection: activeRound.answers[question.id],
        detailNote: activeRound.answerNotes[question.id] ?? '',
      }),
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
