import type {
  DiagnosticTemplateQuestionType,
  DiagnosticTemplateSelectionMode,
  DiagnosticTemplateVisibilityMatchMode,
  DiagnosticTemplateVisibilityRule,
  DiagnosticTemplateValue,
} from '@/lib/diagnostic-template-types';
import { buildApiUrl } from '@/lib/config/build-api-url';

export type DiagnosticTemplateQuestionValue = DiagnosticTemplateValue['rounds'][number]['questions'][number];

export type DiagnosticTemplateOptionValue = DiagnosticTemplateQuestionValue['options'][number];

export type DiagnosticTemplateRoundValue = DiagnosticTemplateValue['rounds'][number];

export type DiagnosticTemplateChildQuestionValue = NonNullable<DiagnosticTemplateOptionValue['childQuestion']>;

export type DiagnosticTemplateChildOptionValue = DiagnosticTemplateChildQuestionValue['options'][number];

export type TemplateQuestionReference = {
  readonly optionChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly questionIndex: number;
  readonly roundIndex: number;
};

export type TemplateSectionKind = 'round' | 'question' | 'option';

export const DIAGNOSTIC_TEMPLATES_API_URL = buildApiUrl('/api/admin/diagnostic-templates');

export const ROUND_SECTION_ID_PREFIX = 'diagnostic-template-round';

export const QUESTION_SECTION_ID_PREFIX = 'diagnostic-template-question';

export const OPTION_SECTION_ID_PREFIX = 'diagnostic-template-option';

export const SAME_QUESTION_PATH_SOURCE_LABEL = 'This question path';

export const SELECTION_MODE_OPTIONS = [
  { value: 'single', label: 'Single select' },
  { value: 'multiple', label: 'Multi select' },
] as const satisfies readonly { value: DiagnosticTemplateSelectionMode; label: string }[];

export const QUESTION_TYPE_OPTIONS = [
  { value: 'multiple-choice', label: 'Multiple choice' },
  { value: 'nested-options', label: 'Nested options' },
  { value: 'ranked-options', label: 'Ranked options' },
] as const satisfies readonly { value: DiagnosticTemplateQuestionType; label: string }[];

export function readQuestionTypeLabel(type: DiagnosticTemplateQuestionType): string {
  const match = QUESTION_TYPE_OPTIONS.find((option) => option.value === type);
  return match?.label ?? type;
}

export function buildTemplateSectionId(params: { readonly entityId: string; readonly kind: TemplateSectionKind }): string {
  const prefix =
    params.kind === 'round'
      ? ROUND_SECTION_ID_PREFIX
      : params.kind === 'question'
        ? QUESTION_SECTION_ID_PREFIX
        : OPTION_SECTION_ID_PREFIX;
  return `${prefix}-${params.entityId}`;
}

export function formatTemplateOutlineRoundLabel(params: {
  readonly round: DiagnosticTemplateValue['rounds'][number];
  readonly roundIndex: number;
}): string {
  return `R${params.roundIndex + 1} · ${params.round.title}`;
}

export function formatTemplateOutlineQuestionLabel(params: {
  readonly question: DiagnosticTemplateQuestionValue;
  readonly questionIndex: number;
}): string {
  const trimmedPrompt = params.question.prompt.trim();
  if (trimmedPrompt.length === 0) {
    return `Q${params.questionIndex + 1}`;
  }
  return `Q${params.questionIndex + 1} · ${trimmedPrompt}`;
}

export function createDraftRound(roundIndex: number): DiagnosticTemplateRoundValue {
  return {
    id: crypto.randomUUID(),
    title: `Round ${roundIndex + 1}`,
    guidance: '',
    order: roundIndex,
    showWhen: null,
    questions: [],
  };
}

export function createDraftQuestion(questionIndex: number): DiagnosticTemplateQuestionValue {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    description: null,
    order: questionIndex,
    showWhen: null,
    type: 'multiple-choice',
    rankedOptionLimit: null,
    selectionMode: 'multiple',
    options: [createDraftOption(0), createDraftOption(1)],
  };
}

export function createDraftChildOption(optionIndex: number): DiagnosticTemplateChildOptionValue {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: null,
    order: optionIndex,
  };
}

export function createDraftChildQuestion(): DiagnosticTemplateChildQuestionValue {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    description: null,
    selectionMode: 'single',
    options: [createDraftChildOption(0), createDraftChildOption(1)],
  };
}

export function createDraftOption(optionIndex: number): DiagnosticTemplateOptionValue {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: null,
    showWhen: null,
    requestDetailNoteWhenSelected: false,
    presentation: {
      icon: null,
      badgeText: null,
      eyebrow: null,
      title: null,
      supportingText: null,
      exampleBullets: [],
      panelTitle: null,
    },
    order: optionIndex,
    childQuestion: null,
  };
}

export function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) {
    return items;
  }
  next.splice(toIndex, 0, item);
  return next;
}

function normalizeSingleRequestDetailNoteTriggerForQuestionOptions<T extends { requestDetailNoteWhenSelected: boolean }>(
  options: readonly T[],
): T[] {
  const firstIndex = options.findIndex((option) => option.requestDetailNoteWhenSelected);
  if (firstIndex === -1) {
    return options.map((option) => ({ ...option, requestDetailNoteWhenSelected: false }));
  }
  return options.map((option, index) => ({
    ...option,
    requestDetailNoteWhenSelected: index === firstIndex,
  }));
}

export function countTemplateQuestions(template: DiagnosticTemplateValue): number {
  return template.rounds.reduce((total, round) => total + round.questions.length, 0);
}

function normalizeExampleBullets(exampleBullets: readonly string[]): readonly string[] {
  return exampleBullets.map((exampleBullet) => exampleBullet.trim()).filter((exampleBullet) => exampleBullet.length > 0);
}

export function parseExampleBulletsInput(input: string): readonly string[] {
  return input.split('\n');
}

export function normalizeExampleBulletsValue(exampleBullets: readonly string[]): readonly string[] {
  return normalizeExampleBullets(exampleBullets);
}

export function normalizeVisibilityRuleValue(rule: DiagnosticTemplateVisibilityRule): DiagnosticTemplateVisibilityRule {
  if (rule === null) {
    return null;
  }
  const sourceQuestionId = rule.sourceQuestionId.trim();
  const optionIds = rule.optionIds
    .map((optionId) => optionId.trim())
    .filter((optionId, index, optionIds) => optionId.length > 0 && optionIds.indexOf(optionId) === index);
  if (sourceQuestionId.length === 0 || optionIds.length === 0) {
    return null;
  }
  return {
    sourceQuestionId,
    optionIds,
    match: rule.match === 'all' ? 'all' : 'any',
  };
}

export function buildTemplateQuestionReferenceMap(template: DiagnosticTemplateValue): Map<string, TemplateQuestionReference> {
  return new Map(
    template.rounds.flatMap((round, roundIndex) =>
      round.questions.map((question, questionIndex) => [
        question.id,
        {
          roundIndex,
          questionIndex,
          optionChoices: question.options.map((option) => ({
            id: option.id,
            label: option.label,
          })),
        },
      ] as const),
    ),
  );
}

export function sanitizeVisibilityRule(params: {
  readonly questionReferences: Map<string, TemplateQuestionReference>;
  readonly rule: DiagnosticTemplateVisibilityRule;
  readonly targetQuestionIndex?: number;
  readonly targetRoundIndex: number;
}): DiagnosticTemplateVisibilityRule {
  const normalizedRule = normalizeVisibilityRuleValue(params.rule);
  if (normalizedRule === null) {
    return null;
  }
  const sourceQuestion = params.questionReferences.get(normalizedRule.sourceQuestionId);
  if (sourceQuestion === undefined) {
    return null;
  }
  const isEarlierQuestion =
    params.targetQuestionIndex === undefined
      ? sourceQuestion.roundIndex < params.targetRoundIndex
      : sourceQuestion.roundIndex < params.targetRoundIndex ||
        (sourceQuestion.roundIndex === params.targetRoundIndex &&
          sourceQuestion.questionIndex < params.targetQuestionIndex);
  if (!isEarlierQuestion) {
    return null;
  }
  const validOptionIds =
    normalizedRule.match === 'any'
      ? sourceQuestion.optionChoices.map((optionChoice) => optionChoice.id)
      : normalizedRule.optionIds.filter((optionId) =>
          sourceQuestion.optionChoices.some((optionChoice) => optionChoice.id === optionId),
        );
  if (validOptionIds.length === 0) {
    return null;
  }
  return {
    sourceQuestionId: normalizedRule.sourceQuestionId,
    optionIds: validOptionIds,
    match: normalizedRule.match,
  };
}

export function sanitizeOptionVisibilityRule(params: {
  readonly questionReferences: Map<string, TemplateQuestionReference>;
  readonly roundIndex: number;
  readonly questionIndex: number;
  readonly optionIds: readonly string[];
  readonly optionIndex: number;
  readonly questionId: string;
  readonly rule: DiagnosticTemplateVisibilityRule;
}): DiagnosticTemplateVisibilityRule {
  const normalizedRule = normalizeVisibilityRuleValue(params.rule);
  if (normalizedRule === null) {
    return null;
  }
  if (normalizedRule.sourceQuestionId !== params.questionId) {
    return sanitizeVisibilityRule({
      questionReferences: params.questionReferences,
      rule: normalizedRule,
      targetRoundIndex: params.roundIndex,
      targetQuestionIndex: params.questionIndex,
    });
  }
  const availableOptionIds = new Set(params.optionIds.slice(0, params.optionIndex));
  const validOptionIds = normalizedRule.optionIds.filter((optionId) => availableOptionIds.has(optionId));
  if (validOptionIds.length === 0) {
    return null;
  }
  return {
    sourceQuestionId: params.questionId,
    optionIds: validOptionIds,
    match: normalizedRule.match,
  };
}

export function buildAvailableVisibilitySourceQuestions(params: {
  readonly roundId: string;
  readonly targetQuestionId?: string;
  readonly template: DiagnosticTemplateValue;
}): readonly {
  readonly id: string;
  readonly label: string;
  readonly optionChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
}[] {
  const availableQuestions: {
    id: string;
    label: string;
    optionChoices: readonly {
      id: string;
      label: string;
    }[];
  }[] = [];
  for (const [roundIndex, round] of params.template.rounds.entries()) {
    if (round.id === params.roundId && params.targetQuestionId === undefined) {
      break;
    }
    for (const [questionIndex, question] of round.questions.entries()) {
      if (round.id === params.roundId && question.id === params.targetQuestionId) {
        return availableQuestions;
      }
      availableQuestions.push({
        id: question.id,
        label: `R${roundIndex + 1} · Q${questionIndex + 1} · ${question.prompt.trim() || 'Untitled question'}`,
        optionChoices: question.options.map((option) => ({
          id: option.id,
          label: option.label.trim() || 'Untitled option',
        })),
      });
    }
  }
  return availableQuestions;
}

export function buildAvailableOptionVisibilityChoices(params: {
  readonly optionId: string;
  readonly question: DiagnosticTemplateQuestionValue;
}): readonly {
  readonly id: string;
  readonly label: string;
}[] {
  const optionChoices: { id: string; label: string }[] = [];
  for (const option of params.question.options) {
    if (option.id === params.optionId) {
      return optionChoices;
    }
    optionChoices.push({
      id: option.id,
      label: option.label.trim() || 'Untitled option',
    });
  }
  return optionChoices;
}

export function buildAvailableOptionVisibilitySources(params: {
  readonly optionId: string;
  readonly question: DiagnosticTemplateQuestionValue;
  readonly roundId: string;
  readonly template: DiagnosticTemplateValue;
}): readonly {
  readonly id: string;
  readonly label: string;
  readonly optionChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
}[] {
  const sameQuestionChoices = buildAvailableOptionVisibilityChoices({
    question: params.question,
    optionId: params.optionId,
  });
  const earlierQuestionChoices = buildAvailableVisibilitySourceQuestions({
    template: params.template,
    roundId: params.roundId,
    targetQuestionId: params.question.id,
  });
  return [
    ...(sameQuestionChoices.length === 0
      ? []
      : [
          {
            id: params.question.id,
            label: SAME_QUESTION_PATH_SOURCE_LABEL,
            optionChoices: sameQuestionChoices,
          },
        ]),
    ...earlierQuestionChoices,
  ];
}

export function buildVisibilityRuleSummary(params: {
  readonly availableQuestions: ReturnType<typeof buildAvailableVisibilitySourceQuestions>;
  readonly rule: DiagnosticTemplateVisibilityRule;
}): string {
  const rule = params.rule;
  if (rule === null) {
    return 'Always visible';
  }
  const sourceQuestion = params.availableQuestions.find((question) => question.id === rule.sourceQuestionId);
  if (sourceQuestion === undefined) {
    return 'Visible when the selected source question matches the configured options.';
  }
  const optionLabels = rule.optionIds
    .map((optionId) => sourceQuestion.optionChoices.find((optionChoice) => optionChoice.id === optionId)?.label ?? optionId)
    .join(rule.match === 'all' ? ' + ' : ' or ');
  return `Visible when ${sourceQuestion.label} includes ${optionLabels}.`;
}

export function buildOptionVisibilityRuleSummary(params: {
  readonly availableSources: readonly {
    readonly id: string;
    readonly label: string;
    readonly optionChoices: readonly {
      readonly id: string;
      readonly label: string;
    }[];
  }[];
  readonly rule: DiagnosticTemplateVisibilityRule;
}): string {
  const rule = params.rule;
  if (rule === null) {
    return 'Always visible';
  }
  const source = params.availableSources.find((source) => source.id === rule.sourceQuestionId);
  if (source === undefined) {
    return 'Visible when the selected source question matches the configured options.';
  }
  const optionLabels = rule.optionIds
    .map((optionId) => source.optionChoices.find((optionChoice) => optionChoice.id === optionId)?.label ?? optionId)
    .join(rule.match === 'all' ? ' + ' : ' or ');
  if (source.id === rule.sourceQuestionId && source.label === SAME_QUESTION_PATH_SOURCE_LABEL) {
    return `Visible when this question path already includes ${optionLabels}.`;
  }
  return `Visible when ${source.label} includes ${optionLabels}.`;
}

export function buildDefaultVisibilityRuleForSource(params: {
  readonly sourceId: string;
  readonly optionChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
}): DiagnosticTemplateVisibilityRule {
  const optionIds = params.optionChoices.map((optionChoice) => optionChoice.id);
  if (optionIds.length === 0) {
    return null;
  }
  return {
    sourceQuestionId: params.sourceId,
    optionIds,
    match: 'any',
  };
}

export function buildVisibilityRuleForMatchMode(params: {
  readonly matchMode: DiagnosticTemplateVisibilityMatchMode;
  readonly optionChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly rule: DiagnosticTemplateVisibilityRule;
}): DiagnosticTemplateVisibilityRule {
  if (params.rule === null) {
    return null;
  }
  const optionIds =
    params.matchMode === 'any'
      ? params.optionChoices.map((optionChoice) => optionChoice.id)
      : params.rule.optionIds;
  if (optionIds.length === 0) {
    return null;
  }
  return {
    ...params.rule,
    optionIds,
    match: params.matchMode,
  };
}

export function reindexTemplate(template: DiagnosticTemplateValue): DiagnosticTemplateValue {
  const templateQuestionReferences = buildTemplateQuestionReferenceMap(template);
  const reindexedTemplate: DiagnosticTemplateValue = {
    ...template,
    rounds: template.rounds.map((round, roundIndex) => ({
      ...round,
      order: roundIndex,
      title: round.title.trim().length > 0 ? round.title : `Round ${roundIndex + 1}`,
      questions: round.questions.map((question, questionIndex) => ({
        ...question,
        order: questionIndex,
        type: QUESTION_TYPE_OPTIONS.some((option) => option.value === question.type) ? question.type : 'multiple-choice',
        rankedOptionLimit:
          question.type === 'ranked-options' &&
          typeof question.rankedOptionLimit === 'number' &&
          question.rankedOptionLimit >= 2
            ? question.rankedOptionLimit
            : question.type === 'ranked-options'
              ? 3
              : null,
        selectionMode: question.selectionMode === 'single' ? 'single' : 'multiple',
        options: normalizeSingleRequestDetailNoteTriggerForQuestionOptions(
          question.options.map((option, optionIndex) => ({
            ...option,
            order: optionIndex,
            requestDetailNoteWhenSelected: option.requestDetailNoteWhenSelected === true,
            showWhen: sanitizeOptionVisibilityRule({
              questionReferences: templateQuestionReferences,
              roundIndex,
              questionIndex,
              questionId: question.id,
              optionIds: question.options.map((candidateOption) => candidateOption.id),
              optionIndex,
              rule: option.showWhen,
            }),
            presentation: {
              icon: option.presentation.icon?.trim() ?? null,
              badgeText: option.presentation.badgeText?.trim() ?? null,
              eyebrow: option.presentation.eyebrow?.trim() ?? null,
              title: option.presentation.title?.trim() ?? null,
              supportingText: option.presentation.supportingText?.trim() ?? null,
              exampleBullets: normalizeExampleBullets(option.presentation.exampleBullets),
              panelTitle: option.presentation.panelTitle?.trim() ?? null,
            },
            childQuestion:
              option.childQuestion === null
                ? null
                : {
                    ...option.childQuestion,
                    selectionMode: option.childQuestion.selectionMode === 'multiple' ? 'multiple' : 'single',
                    options: option.childQuestion.options.map((childOption, childOptionIndex) => ({
                      ...childOption,
                      order: childOptionIndex,
                    })),
                  },
          })),
        ),
      })),
    })),
  };
  const questionReferences = buildTemplateQuestionReferenceMap(reindexedTemplate);
  return {
    ...reindexedTemplate,
    rounds: reindexedTemplate.rounds.map((round, roundIndex) => ({
      ...round,
      showWhen: sanitizeVisibilityRule({
        questionReferences,
        rule: round.showWhen,
        targetRoundIndex: roundIndex,
      }),
      questions: round.questions.map((question, questionIndex) => ({
        ...question,
        showWhen: sanitizeVisibilityRule({
          questionReferences,
          rule: question.showWhen,
          targetRoundIndex: roundIndex,
          targetQuestionIndex: questionIndex,
        }),
      })),
    })),
  };
}

export function buildTemplatePatchBody(template: DiagnosticTemplateValue): string {
  return JSON.stringify({
    name: template.name,
    rounds: template.rounds.map((round) => ({
      id: round.id,
      title: round.title,
      guidance: round.guidance,
      showWhen: round.showWhen,
      questions: round.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        description: question.description,
        showWhen: question.showWhen,
        type: question.type,
        rankedOptionLimit: question.rankedOptionLimit,
        selectionMode: question.selectionMode,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          showWhen: option.showWhen,
          requestDetailNoteWhenSelected: option.requestDetailNoteWhenSelected === true,
          presentation: {
            icon: option.presentation.icon,
            badgeText: option.presentation.badgeText,
            eyebrow: option.presentation.eyebrow,
            title: option.presentation.title,
            supportingText: option.presentation.supportingText,
            exampleBullets: normalizeExampleBullets(option.presentation.exampleBullets),
            panelTitle: option.presentation.panelTitle,
          },
          childQuestion:
            option.childQuestion === null
              ? null
              : {
                  id: option.childQuestion.id,
                  prompt: option.childQuestion.prompt,
                  description: option.childQuestion.description,
                  selectionMode: option.childQuestion.selectionMode,
                  options: option.childQuestion.options.map((childOption) => ({
                    id: childOption.id,
                    label: childOption.label,
                    description: childOption.description,
                  })),
                },
        })),
      })),
    })),
  });
}

export function findQuestionById(
  template: DiagnosticTemplateValue,
  questionId: string,
): { readonly round: DiagnosticTemplateRoundValue; readonly question: DiagnosticTemplateQuestionValue; readonly roundIndex: number; readonly questionIndex: number } | null {
  for (const [roundIndex, round] of template.rounds.entries()) {
    for (const [questionIndex, question] of round.questions.entries()) {
      if (question.id === questionId) {
        return { round, question, roundIndex, questionIndex };
      }
    }
  }
  return null;
}

export function findOptionById(
  template: DiagnosticTemplateValue,
  optionId: string,
): {
  readonly round: DiagnosticTemplateRoundValue;
  readonly question: DiagnosticTemplateQuestionValue;
  readonly option: DiagnosticTemplateOptionValue;
  readonly roundIndex: number;
  readonly questionIndex: number;
  readonly optionIndex: number;
} | null {
  for (const [roundIndex, round] of template.rounds.entries()) {
    for (const [questionIndex, question] of round.questions.entries()) {
      for (const [optionIndex, option] of question.options.entries()) {
        if (option.id === optionId) {
          return { round, question, option, roundIndex, questionIndex, optionIndex };
        }
      }
    }
  }
  return null;
}

export function updateTemplateWithReindex(
  template: DiagnosticTemplateValue,
  updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
  shouldReindex = true,
): DiagnosticTemplateValue {
  const updated = updater(template);
  return shouldReindex ? reindexTemplate(updated) : updated;
}
