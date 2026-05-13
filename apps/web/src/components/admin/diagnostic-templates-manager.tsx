'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { AlertTriangle, CheckCircle2, GripVertical, PencilLine, Plus, Save, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useState, type ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type {
  DiagnosticTemplateQuestionType,
  DiagnosticTemplateSelectionMode,
  DiagnosticTemplateVisibilityMatchMode,
  DiagnosticTemplateVisibilityRule,
  DiagnosticTemplateValue,
} from '@/lib/diagnostic-template-types';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { cn } from '@/lib/utils';

type DiagnosticTemplatesManagerProps = {
  readonly initialTemplates: readonly DiagnosticTemplateValue[];
  readonly displayMode?: 'workspace' | 'editor';
  readonly listHref?: string;
};

type DiagnosticTemplateQuestionValue = DiagnosticTemplateValue['rounds'][number]['questions'][number];

type DiagnosticTemplateOptionValue = DiagnosticTemplateQuestionValue['options'][number];

type DiagnosticTemplateRoundValue = DiagnosticTemplateValue['rounds'][number];

type DiagnosticTemplateChildQuestionValue = NonNullable<DiagnosticTemplateOptionValue['childQuestion']>;

type DiagnosticTemplateChildOptionValue = DiagnosticTemplateChildQuestionValue['options'][number];

type TemplateQuestionReference = {
  readonly optionChoices: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly questionIndex: number;
  readonly roundIndex: number;
};

type TemplateApiResponse = {
  readonly template?: DiagnosticTemplateValue;
  readonly error?: string;
  readonly details?: string;
};

type DiagnosticTemplateTableRow = {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly roundCount: number;
  readonly questionCount: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

const DIAGNOSTIC_TEMPLATES_API_URL = buildApiUrl('/api/admin/diagnostic-templates');
const TEMPLATE_TABLE_PAGE_SIZE = 7;
const TEMPLATE_TABLE_COLUMN_HELPER = createColumnHelper<DiagnosticTemplateTableRow>();
const TEMPLATE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});
const ROUND_SECTION_ID_PREFIX = 'diagnostic-template-round';
const QUESTION_SECTION_ID_PREFIX = 'diagnostic-template-question';
const SAME_QUESTION_PATH_SOURCE_LABEL = 'This question path';
const ROW_INTERACTIVE_ELEMENT_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [data-row-interactive="true"]';

const SELECTION_MODE_OPTIONS = [
  { value: 'single', label: 'Single select' },
  { value: 'multiple', label: 'Multi select' },
] as const satisfies readonly { value: DiagnosticTemplateSelectionMode; label: string }[];

const QUESTION_TYPE_OPTIONS = [
  { value: 'multiple-choice', label: 'Multiple choice' },
  { value: 'nested-options', label: 'Nested options' },
  { value: 'ranked-options', label: 'Ranked options' },
] as const satisfies readonly { value: DiagnosticTemplateQuestionType; label: string }[];

type TemplateSectionKind = 'round' | 'question';

type UpdateSelectedTemplateOptions = {
  readonly shouldReindex?: boolean;
};

function buildTemplateSectionId(params: { readonly entityId: string; readonly kind: TemplateSectionKind }): string {
  const prefix = params.kind === 'round' ? ROUND_SECTION_ID_PREFIX : QUESTION_SECTION_ID_PREFIX;
  return `${prefix}-${params.entityId}`;
}

function formatTemplateOutlineRoundLabel(params: {
  readonly round: DiagnosticTemplateValue['rounds'][number];
  readonly roundIndex: number;
}): string {
  return `R${params.roundIndex + 1} · ${params.round.title}`;
}

function formatTemplateOutlineQuestionLabel(params: {
  readonly question: DiagnosticTemplateQuestionValue;
  readonly questionIndex: number;
}): string {
  const trimmedPrompt = params.question.prompt.trim();
  if (trimmedPrompt.length === 0) {
    return `Q${params.questionIndex + 1}`;
  }
  return `Q${params.questionIndex + 1} · ${trimmedPrompt}`;
}

function createDraftRound(roundIndex: number): DiagnosticTemplateValue['rounds'][number] {
  return {
    id: crypto.randomUUID(),
    title: `Round ${roundIndex + 1}`,
    guidance: '',
    order: roundIndex,
    showWhen: null,
    questions: [],
  };
}

function createDraftQuestion(questionIndex: number): DiagnosticTemplateValue['rounds'][number]['questions'][number] {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    description: null,
    order: questionIndex,
    showWhen: null,
    type: 'multiple-choice',
    rankedOptionLimit: null,
    selectionMode: 'multiple',
    options: [
      createDraftOption(0),
      createDraftOption(1),
    ],
  };
}

function createDraftChildOption(optionIndex: number): DiagnosticTemplateChildOptionValue {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: null,
    order: optionIndex,
  };
}

function createDraftChildQuestion(): DiagnosticTemplateChildQuestionValue {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    description: null,
    selectionMode: 'single',
    options: [
      createDraftChildOption(0),
      createDraftChildOption(1),
    ],
  };
}

function createDraftOption(
  optionIndex: number,
): DiagnosticTemplateValue['rounds'][number]['questions'][number]['options'][number] {
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

function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
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

function countTemplateQuestions(template: DiagnosticTemplateValue): number {
  return template.rounds.reduce((total, round) => total + round.questions.length, 0);
}

function formatTemplateDateTime(isoTimestamp: string): string {
  return TEMPLATE_DATE_TIME_FORMATTER.format(new Date(isoTimestamp));
}

function isInteractiveRowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.closest(ROW_INTERACTIVE_ELEMENT_SELECTOR) !== null;
}

function parseExampleBulletsInput(input: string): readonly string[] {
  return input.split('\n');
}

function normalizeExampleBullets(exampleBullets: readonly string[]): readonly string[] {
  return exampleBullets.map((exampleBullet) => exampleBullet.trim()).filter((exampleBullet) => exampleBullet.length > 0);
}

function normalizeVisibilityRuleValue(rule: DiagnosticTemplateVisibilityRule): DiagnosticTemplateVisibilityRule {
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

function buildTemplateQuestionReferenceMap(template: DiagnosticTemplateValue): Map<string, TemplateQuestionReference> {
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

function sanitizeVisibilityRule(params: {
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

function sanitizeOptionVisibilityRule(params: {
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

function buildAvailableVisibilitySourceQuestions(params: {
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

function buildAvailableOptionVisibilityChoices(params: {
  readonly optionId: string;
  readonly question: DiagnosticTemplateQuestionValue;
}): readonly {
  readonly id: string;
  readonly label: string;
}[] {
  const optionChoices: {
    id: string;
    label: string;
  }[] = [];
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

function buildAvailableOptionVisibilitySources(params: {
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

function buildVisibilityRuleSummary(params: {
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

function buildOptionVisibilityRuleSummary(params: {
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

function buildDefaultVisibilityRuleForSource(params: {
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

function buildVisibilityRuleForMatchMode(params: {
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

function reindexTemplate(template: DiagnosticTemplateValue): DiagnosticTemplateValue {
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

function buildTemplatePatchBody(template: DiagnosticTemplateValue): string {
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

type SortableOptionRowProps = {
  readonly children?: ReactNode;
  readonly optionIndex: number;
  readonly optionsCount: number;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onRemove: () => void;
};

type OptionRowContentProps = {
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly children?: ReactNode;
  readonly dragHandle: ReactNode;
  readonly isDragging: boolean;
  readonly onMoveDown: () => void;
  readonly onMoveUp: () => void;
  readonly onRemove: () => void;
  readonly optionIndex: number;
};

function OptionRowContent(props: OptionRowContentProps): ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-background px-3 py-3',
        props.isDragging && 'border-primary/40 bg-primary/5 shadow-sm',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {props.dragHandle}
          <span className="text-xs font-medium">Option {props.optionIndex + 1}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={props.onMoveUp} disabled={!props.canMoveUp}>
            Move up
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={props.onMoveDown} disabled={!props.canMoveDown}>
            Move down
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={props.onRemove}>
            Remove
          </Button>
        </div>
      </div>
      {props.children}
    </div>
  );
}

function StaticOptionRow(props: SortableOptionRowProps): ReactElement {
  return (
    <OptionRowContent
      dragHandle={
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground"
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
      }
      isDragging={false}
      optionIndex={props.optionIndex}
      canMoveUp={props.optionIndex > 0}
      canMoveDown={props.optionIndex < props.optionsCount - 1}
      onMoveUp={props.onMoveUp}
      onMoveDown={props.onMoveDown}
      onRemove={props.onRemove}
    >
      {props.children}
    </OptionRowContent>
  );
}

export function DiagnosticTemplatesManager(props: DiagnosticTemplatesManagerProps): ReactElement {
  const router = useRouter();
  const displayMode = props.displayMode ?? 'workspace';
  const isEditorMode = displayMode === 'editor';
  const listHref = props.listHref ?? '/admin/diagnostic-templates';
  const [templates, setTemplates] = useState<readonly DiagnosticTemplateValue[]>(props.initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(props.initialTemplates[0]?.id ?? null);
  const [dirtyTemplateIds, setDirtyTemplateIds] = useState<readonly string[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState<boolean>(props.initialTemplates.length === 0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateSearchValue, setTemplateSearchValue] = useState<string>('');
  const [templateTablePagination, setTemplateTablePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: TEMPLATE_TABLE_PAGE_SIZE,
  });
  const [templateTableSorting, setTemplateTableSorting] = useState<SortingState>([
    { id: 'isActive', desc: true },
    { id: 'updatedAtIso', desc: true },
  ]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const hasDirtySelectedTemplate =
    selectedTemplate !== null && dirtyTemplateIds.includes(selectedTemplate.id);
  const templateTableRows = useMemo<readonly DiagnosticTemplateTableRow[]>(
    () =>
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        isActive: template.isActive,
        hasUnsavedChanges: dirtyTemplateIds.includes(template.id),
        roundCount: template.rounds.length,
        questionCount: countTemplateQuestions(template),
        createdAtIso: template.createdAtIso,
        updatedAtIso: template.updatedAtIso,
      })),
    [dirtyTemplateIds, templates],
  );
  const templateTableData = useMemo<DiagnosticTemplateTableRow[]>(() => templateTableRows.slice(), [templateTableRows]);

  function replaceTemplateInState(nextTemplate: DiagnosticTemplateValue): void {
    setTemplates((previous) => previous.map((template) => (template.id === nextTemplate.id ? nextTemplate : template)));
  }

  function markTemplateDirty(templateId: string): void {
    setDirtyTemplateIds((previous) => (previous.includes(templateId) ? previous : [...previous, templateId]));
  }

  function clearDirtyTemplate(templateId: string): void {
    setDirtyTemplateIds((previous) => previous.filter((id) => id !== templateId));
  }

  const executeSelectTemplate = useCallback((templateId: string): void => {
    setSelectedTemplateId(templateId);
    setStatusMessage(null);
    setErrorMessage(null);
  }, []);

  function executeScrollToTemplateSection(sectionId: string): void {
    const targetElement = document.getElementById(sectionId);
    if (!(targetElement instanceof HTMLElement)) {
      return;
    }
    targetElement.focus({ preventScroll: true });
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function executeScrollToTemplateSectionSoon(sectionId: string): void {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        executeScrollToTemplateSection(sectionId);
      });
    });
  }

  function executeAddRound(): void {
    if (selectedTemplate === null) {
      return;
    }
    const nextRound = createDraftRound(selectedTemplate.rounds.length);
    updateSelectedTemplate((template) => ({
      ...template,
      rounds: [...template.rounds, nextRound],
    }));
    executeScrollToTemplateSectionSoon(
      buildTemplateSectionId({
        kind: 'round',
        entityId: nextRound.id,
      }),
    );
  }

  function executeAddQuestionToRound(roundId: string): void {
    if (selectedTemplate === null) {
      return;
    }
    const targetRound = selectedTemplate.rounds.find((round) => round.id === roundId);
    if (targetRound === undefined) {
      return;
    }
    const nextQuestion = createDraftQuestion(targetRound.questions.length);
    updateSelectedTemplate((template) => ({
      ...template,
      rounds: template.rounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              questions: [...round.questions, nextQuestion],
            }
          : round,
      ),
    }));
    executeScrollToTemplateSectionSoon(
      buildTemplateSectionId({
        kind: 'question',
        entityId: nextQuestion.id,
      }),
    );
  }

  function executeAddOptionToQuestion(params: { readonly questionId: string; readonly roundId: string }): void {
    if (selectedTemplate === null) {
      return;
    }
    const targetRound = selectedTemplate.rounds.find((round) => round.id === params.roundId);
    const targetQuestion = targetRound?.questions.find((question) => question.id === params.questionId);
    if (targetQuestion === undefined) {
      return;
    }
    const nextOption = createDraftOption(targetQuestion.options.length);
    updateSelectedTemplate((template) => ({
      ...template,
      rounds: template.rounds.map((round) =>
        round.id === params.roundId
          ? {
              ...round,
              questions: round.questions.map((question) =>
                question.id === params.questionId
                  ? {
                      ...question,
                      options: [...question.options, nextOption],
                    }
                  : question,
              ),
            }
          : round,
      ),
    }));
    executeScrollToTemplateSectionSoon(
      buildTemplateSectionId({
        kind: 'question',
        entityId: params.questionId,
      }),
    );
  }

  function executeOpenCreateForm(): void {
    setIsCreateFormOpen(true);
    setNewTemplateName('');
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function updateSelectedTemplate(
    updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
    options: UpdateSelectedTemplateOptions = {},
  ): void {
    if (selectedTemplate === null) {
      return;
    }
    const updatedTemplate = updater(selectedTemplate);
    const nextTemplate = options.shouldReindex === false ? updatedTemplate : reindexTemplate(updatedTemplate);
    replaceTemplateInState(nextTemplate);
    markTemplateDirty(nextTemplate.id);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function executeCreateTemplate(templateName?: string): Promise<void> {
    setIsCreating(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const trimmedTemplateName = templateName?.trim() ?? '';
      const response = await fetch(DIAGNOSTIC_TEMPLATES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmedTemplateName.length > 0 ? { name: trimmedTemplateName } : {}),
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to create diagnostic template.');
      }
      setTemplates((previous) => [data.template!, ...previous]);
      setSelectedTemplateId(data.template.id);
      setTemplateSearchValue('');
      setNewTemplateName('');
      setIsCreateFormOpen(false);
      setStatusMessage('New template created.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create diagnostic template.');
    } finally {
      setIsCreating(false);
    }
  }

  async function executeSaveSelectedTemplate(): Promise<void> {
    if (selectedTemplate === null) {
      return;
    }
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: buildTemplatePatchBody(selectedTemplate),
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to save diagnostic template.');
      }
      replaceTemplateInState(data.template);
      clearDirtyTemplate(data.template.id);
      setStatusMessage('Template saved.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save diagnostic template.');
    } finally {
      setIsSaving(false);
    }
  }

  const executeActivateTemplate = useCallback(async (templateId: string): Promise<void> => {
    setActivatingTemplateId(templateId);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${templateId}/activate`, {
        method: 'POST',
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to activate diagnostic template.');
      }
      setTemplates((previous) =>
        previous.map((template) =>
          template.id === data.template!.id
            ? data.template!
            : {
                ...template,
                isActive: false,
              },
        ),
      );
      setStatusMessage(`"${data.template.name}" is now active for customer-facing diagnostics.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to activate diagnostic template.');
    } finally {
      setActivatingTemplateId(null);
    }
  }, []);

  const executeDeleteTemplate = useCallback(async (templateId: string): Promise<void> => {
    const templateToDelete = templates.find((template) => template.id === templateId);
    if (templateToDelete === undefined) {
      return;
    }
    const confirmed = window.confirm(`Delete "${templateToDelete.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setDeletingTemplateId(templateId);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${templateId}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { readonly error?: string; readonly details?: string };
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? 'Failed to delete diagnostic template.');
      }
      const remainingTemplates = templates.filter((template) => template.id !== templateId);
      setTemplates(remainingTemplates);
      setDirtyTemplateIds((previous) => previous.filter((id) => id !== templateId));
      setSelectedTemplateId((previous) => {
        if (previous !== templateId) {
          return previous;
        }
        return remainingTemplates[0]?.id ?? null;
      });
      setStatusMessage('Template deleted.');
      if (isEditorMode) {
        router.push(listHref);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete diagnostic template.');
    } finally {
      setDeletingTemplateId(null);
    }
  }, [isEditorMode, listHref, router, templates]);

  const templateTableColumns = useMemo(
    () => [
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('name', {
        header: 'Template',
        cell: (info) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{info.getValue()}</p>
            <p className="text-xs text-muted-foreground">Created {formatTemplateDateTime(info.row.original.createdAtIso)}</p>
          </div>
        ),
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('roundCount', {
        header: 'Rounds',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('questionCount', {
        header: 'Questions',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('updatedAtIso', {
        header: 'Updated',
        cell: (info) => (
          <span className="text-sm text-muted-foreground">{formatTemplateDateTime(info.getValue())}</span>
        ),
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('isActive', {
        header: 'Status',
        cell: (info) => (
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold',
                info.getValue()
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted/60 text-muted-foreground',
              )}
            >
              {info.getValue() ? 'Active' : 'Draft'}
            </span>
            {info.row.original.hasUnsavedChanges ? (
              <span className="inline-flex items-center rounded-full border border-warning/35 bg-warning-soft px-2 py-1 text-[11px] font-semibold text-warning-foreground dark:bg-warning/15 dark:text-warning">
                Unsaved
              </span>
            ) : null}
          </div>
        ),
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const isActiveTemplate = info.row.original.isActive;
          return (
            <div
              data-row-interactive="true"
              className="flex items-center justify-end gap-1"
              onClick={(event) => {
                event.stopPropagation();
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Edit ${info.row.original.name}`}
                title={`Edit ${info.row.original.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  executeSelectTemplate(info.row.original.id);
                }}
              >
                <PencilLine className="size-4" aria-hidden />
              </Button>
              {!isActiveTemplate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Set ${info.row.original.name} active`}
                  title="Set active"
                  onClick={(event) => {
                    event.stopPropagation();
                    void executeActivateTemplate(info.row.original.id);
                  }}
                  disabled={activatingTemplateId === info.row.original.id}
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                </Button>
              ) : null}
              {!isActiveTemplate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${info.row.original.name}`}
                  title={`Delete ${info.row.original.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void executeDeleteTemplate(info.row.original.id);
                  }}
                  disabled={deletingTemplateId === info.row.original.id}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                </Button>
              ) : null}
            </div>
          );
        },
      }),
    ],
    [activatingTemplateId, deletingTemplateId, executeActivateTemplate, executeDeleteTemplate, executeSelectTemplate],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable refs for pagination and row models; intentional here.
  const templateTable = useReactTable({
    data: templateTableData,
    columns: templateTableColumns,
    state: {
      globalFilter: templateSearchValue,
      pagination: templateTablePagination,
      sorting: templateTableSorting,
    },
    onGlobalFilterChange: setTemplateSearchValue,
    onPaginationChange: setTemplateTablePagination,
    onSortingChange: setTemplateTableSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
  });
  const filteredTemplateCount = templateTable.getFilteredRowModel().rows.length;

  function renderSelectionModeButtons(params: {
    readonly currentMode: DiagnosticTemplateSelectionMode;
    readonly label: string;
    readonly onSelect: (mode: DiagnosticTemplateSelectionMode) => void;
  }): ReactElement {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{params.label}</p>
        <div className="flex flex-wrap gap-2">
          {SELECTION_MODE_OPTIONS.map((selectionModeOption) => {
            const isActive = params.currentMode === selectionModeOption.value;
            return (
              <Button
                key={selectionModeOption.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => params.onSelect(selectionModeOption.value)}
              >
                {selectionModeOption.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderQuestionTypeButtons(params: {
    readonly currentType: DiagnosticTemplateQuestionType;
    readonly label: string;
    readonly onSelect: (questionType: DiagnosticTemplateQuestionType) => void;
  }): ReactElement {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{params.label}</p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPE_OPTIONS.map((questionTypeOption) => {
            const isActive = params.currentType === questionTypeOption.value;
            return (
              <Button
                key={questionTypeOption.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => params.onSelect(questionTypeOption.value)}
              >
                {questionTypeOption.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderVisibilityRuleEditor(params: {
    readonly availableQuestions: ReturnType<typeof buildAvailableVisibilitySourceQuestions>;
    readonly description: string;
    readonly label: string;
    readonly onChange: (nextRule: DiagnosticTemplateVisibilityRule) => void;
    readonly rule: DiagnosticTemplateVisibilityRule;
  }): ReactElement {
    const rule = params.rule;
    const selectedSourceQuestion =
      rule === null ? null : params.availableQuestions.find((question) => question.id === rule.sourceQuestionId) ?? null;
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{params.label}</p>
          <p className="text-xs text-muted-foreground">{params.description}</p>
        </div>
        {params.availableQuestions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
            Add earlier questions first. They become available here as dependency sources.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Source question</span>
                <select
                  value={params.rule?.sourceQuestionId ?? ''}
                  onChange={(event) => {
                    const nextSourceQuestion = params.availableQuestions.find(
                      (question) => question.id === event.target.value,
                    );
                    if (nextSourceQuestion === undefined) {
                      params.onChange(null);
                      return;
                    }
                    params.onChange(
                      buildDefaultVisibilityRuleForSource({
                        sourceId: nextSourceQuestion.id,
                        optionChoices: nextSourceQuestion.optionChoices,
                      }),
                    );
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <option value="">Always visible</option>
                  {params.availableQuestions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Match rule</span>
                <div className="flex flex-wrap gap-2">
                  {(['any', 'all'] as const satisfies readonly DiagnosticTemplateVisibilityMatchMode[]).map((matchMode) => (
                    <Button
                      key={matchMode}
                      type="button"
                      variant={params.rule?.match === matchMode ? 'default' : 'outline'}
                      size="sm"
                      disabled={params.rule === null}
                      onClick={() => {
                        if (params.rule === null || selectedSourceQuestion === null) {
                          return;
                        }
                        params.onChange(
                          buildVisibilityRuleForMatchMode({
                            matchMode,
                            rule: params.rule,
                            optionChoices: selectedSourceQuestion.optionChoices,
                          }),
                        );
                      }}
                    >
                      {matchMode === 'any' ? 'Any selected option' : 'All selected options'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {selectedSourceQuestion !== null ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Trigger options</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSourceQuestion.optionChoices.map((optionChoice) => {
                      const isSelected = params.rule?.optionIds.includes(optionChoice.id) ?? false;
                      const isLastSelectedOption = params.rule?.optionIds.length === 1 && isSelected;
                      return (
                        <Button
                          key={optionChoice.id}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            if (params.rule === null) {
                              return;
                            }
                            const nextOptionIds = isSelected
                              ? isLastSelectedOption
                                ? params.rule.optionIds
                                : params.rule.optionIds.filter((optionId) => optionId !== optionChoice.id)
                              : [...params.rule.optionIds, optionChoice.id];
                            params.onChange({
                              ...params.rule,
                              optionIds: nextOptionIds,
                            });
                          }}
                        >
                          {optionChoice.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-xs text-muted-foreground">
                  {buildVisibilityRuleSummary({
                    availableQuestions: params.availableQuestions,
                    rule: params.rule,
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  function renderOptionVisibilityRuleEditor(params: {
    readonly availableSources: readonly {
      readonly id: string;
      readonly label: string;
      readonly optionChoices: readonly {
        readonly id: string;
        readonly label: string;
      }[];
    }[];
    readonly embedded?: boolean;
    readonly onChange: (nextRule: DiagnosticTemplateVisibilityRule) => void;
    readonly rule: DiagnosticTemplateVisibilityRule;
  }): ReactElement {
    const rule = params.rule;
    const selectedSource = rule === null ? null : params.availableSources.find((source) => source.id === rule.sourceQuestionId) ?? null;
    const isEmbedded = params.embedded === true;
    return (
      <div className={isEmbedded ? 'space-y-3' : 'rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4'}>
        <div className={isEmbedded ? 'space-y-1' : 'space-y-1'}>
          <p className={isEmbedded ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-medium text-foreground'}>
            Option visibility
          </p>
          {!isEmbedded ? (
            <p className="text-xs text-muted-foreground">
              Reveal this option from an earlier question or from the selected path inside this question.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Control when this option appears based on earlier answers or the path within this question.
            </p>
          )}
        </div>
        {params.availableSources.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
            Add an earlier question or earlier sibling option first. They become available here as dependency sources.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Source</span>
                <select
                  value={rule?.sourceQuestionId ?? ''}
                  onChange={(event) => {
                    const nextSource = params.availableSources.find((source) => source.id === event.target.value);
                    if (nextSource === undefined) {
                      params.onChange(null);
                      return;
                    }
                    params.onChange(
                      buildDefaultVisibilityRuleForSource({
                        sourceId: nextSource.id,
                        optionChoices: nextSource.optionChoices,
                      }),
                    );
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <option value="">Always visible</option>
                  {params.availableSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Match rule</span>
                <div className="flex flex-wrap gap-2">
                  {(['any', 'all'] as const satisfies readonly DiagnosticTemplateVisibilityMatchMode[]).map((matchMode) => (
                    <Button
                      key={matchMode}
                      type="button"
                      variant={rule?.match === matchMode ? 'default' : 'outline'}
                      size="sm"
                      disabled={rule === null}
                      onClick={() => {
                        if (rule === null || selectedSource === null) {
                          return;
                        }
                        params.onChange(
                          buildVisibilityRuleForMatchMode({
                            matchMode,
                            rule,
                            optionChoices: selectedSource.optionChoices,
                          }),
                        );
                      }}
                    >
                      {matchMode === 'any' ? 'Any selected option' : 'All selected options'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {selectedSource !== null ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Trigger options</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSource.optionChoices.map((optionChoice) => {
                      const isSelected = rule?.optionIds.includes(optionChoice.id) ?? false;
                      const isLastSelectedOption = rule?.optionIds.length === 1 && isSelected;
                      return (
                        <Button
                          key={optionChoice.id}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            if (rule === null) {
                              return;
                            }
                            const nextOptionIds = isSelected
                              ? isLastSelectedOption
                                ? rule.optionIds
                                : rule.optionIds.filter((optionId) => optionId !== optionChoice.id)
                              : [...rule.optionIds, optionChoice.id];
                            params.onChange({
                              ...rule,
                              optionIds: nextOptionIds,
                            });
                          }}
                        >
                          {optionChoice.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-xs text-muted-foreground">
                  {buildOptionVisibilityRuleSummary({
                    availableSources: params.availableSources,
                    rule,
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  function updateQuestionOption(params: {
    readonly optionId: string;
    readonly questionId: string;
    readonly roundId: string;
    readonly shouldReindex?: boolean;
    readonly updater: (option: DiagnosticTemplateOptionValue) => DiagnosticTemplateOptionValue;
  }): void {
    updateSelectedTemplate(
      (template) => ({
        ...template,
        rounds: template.rounds.map((candidateRound) =>
          candidateRound.id === params.roundId
            ? {
                ...candidateRound,
                questions: candidateRound.questions.map((candidateQuestion) =>
                  candidateQuestion.id === params.questionId
                    ? {
                        ...candidateQuestion,
                        options: candidateQuestion.options.map((candidateOption) =>
                          candidateOption.id === params.optionId ? params.updater(candidateOption) : candidateOption,
                        ),
                      }
                    : candidateQuestion,
                ),
              }
            : candidateRound,
        ),
      }),
      { shouldReindex: params.shouldReindex },
    );
  }

  function updateOptionChildQuestion(params: {
    readonly optionId: string;
    readonly questionId: string;
    readonly roundId: string;
    readonly shouldReindex?: boolean;
    readonly updater: (
      childQuestion: DiagnosticTemplateChildQuestionValue | null,
    ) => DiagnosticTemplateChildQuestionValue | null;
  }): void {
    updateQuestionOption({
      roundId: params.roundId,
      questionId: params.questionId,
      optionId: params.optionId,
      shouldReindex: params.shouldReindex,
      updater: (option) => ({
        ...option,
        childQuestion: params.updater(option.childQuestion),
      }),
    });
  }

  function renderChildQuestionEditor(params: {
    readonly embedded?: boolean;
    readonly option: DiagnosticTemplateOptionValue;
    readonly questionId: string;
    readonly roundId: string;
  }): ReactElement {
    const childQuestion = params.option.childQuestion;
    const isEmbedded = params.embedded === true;
    if (childQuestion === null) {
      return (
        <div
          className={
            isEmbedded
              ? 'rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-3'
              : 'rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3'
          }
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateOptionChildQuestion({
                roundId: params.roundId,
                questionId: params.questionId,
                optionId: params.option.id,
                updater: () => createDraftChildQuestion(),
              })
            }
          >
            <Plus className="size-4" aria-hidden />
            Add follow-up question
          </Button>
        </div>
      );
    }
    return (
      <div className={isEmbedded ? 'space-y-3' : 'rounded-xl border border-border/70 bg-muted/30 px-4 py-4'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={isEmbedded ? 'text-xs font-medium text-foreground' : 'text-sm font-medium text-foreground'}>
              Follow-up question
            </p>
            <p className="text-xs text-muted-foreground">
              This appears only when customers choose this parent option.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateOptionChildQuestion({
                roundId: params.roundId,
                questionId: params.questionId,
                optionId: params.option.id,
                updater: () => null,
              })
            }
          >
            Remove follow-up
          </Button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <label htmlFor={`child-question-prompt-${childQuestion.id}`} className="text-sm font-medium text-foreground">
              Follow-up prompt
            </label>
            <Input
              id={`child-question-prompt-${childQuestion.id}`}
              value={childQuestion.prompt}
              onChange={(event) =>
                updateOptionChildQuestion({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (currentChildQuestion) =>
                    currentChildQuestion === null
                      ? currentChildQuestion
                      : {
                          ...currentChildQuestion,
                          prompt: event.target.value,
                        },
                })
              }
              placeholder="Example: Which specific manual tasks are the biggest burden?"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`child-question-description-${childQuestion.id}`} className="text-sm font-medium text-foreground">
              Follow-up subtext
            </label>
            <Textarea
              id={`child-question-description-${childQuestion.id}`}
              rows={2}
              value={childQuestion.description ?? ''}
              onChange={(event) =>
                updateOptionChildQuestion({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (currentChildQuestion) =>
                    currentChildQuestion === null
                      ? currentChildQuestion
                      : {
                          ...currentChildQuestion,
                          description: event.target.value,
                        },
                })
              }
              placeholder="Optional supporting text shown above the nested options."
            />
          </div>
        </div>
        <div className="mt-4">
          {renderSelectionModeButtons({
            currentMode: childQuestion.selectionMode,
            label: 'Follow-up selection mode',
            onSelect: (selectionMode) =>
              updateOptionChildQuestion({
                roundId: params.roundId,
                questionId: params.questionId,
                optionId: params.option.id,
                updater: (currentChildQuestion) =>
                  currentChildQuestion === null
                    ? currentChildQuestion
                    : {
                        ...currentChildQuestion,
                        selectionMode,
                      },
              }),
          })}
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Follow-up options</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateOptionChildQuestion({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  updater: (currentChildQuestion) =>
                    currentChildQuestion === null
                      ? currentChildQuestion
                      : {
                          ...currentChildQuestion,
                          options: [...currentChildQuestion.options, createDraftChildOption(currentChildQuestion.options.length)],
                        },
                })
              }
            >
              <Plus className="size-4" aria-hidden />
              Add follow-up option
            </Button>
          </div>
          <div className="space-y-2">
            {childQuestion.options.map((childOption, childOptionIndex) => (
              <div key={childOption.id} className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Follow-up option {childOptionIndex + 1}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateOptionChildQuestion({
                        roundId: params.roundId,
                        questionId: params.questionId,
                        optionId: params.option.id,
                        updater: (currentChildQuestion) =>
                          currentChildQuestion === null
                            ? currentChildQuestion
                            : {
                                ...currentChildQuestion,
                                options: currentChildQuestion.options.filter(
                                  (candidateChildOption) => candidateChildOption.id !== childOption.id,
                                ),
                              },
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Label</p>
                    <Input
                      value={childOption.label}
                      onChange={(event) =>
                        updateOptionChildQuestion({
                          roundId: params.roundId,
                          questionId: params.questionId,
                          optionId: params.option.id,
                          shouldReindex: false,
                          updater: (currentChildQuestion) =>
                            currentChildQuestion === null
                              ? currentChildQuestion
                              : {
                                  ...currentChildQuestion,
                                  options: currentChildQuestion.options.map((candidateChildOption) =>
                                    candidateChildOption.id === childOption.id
                                      ? {
                                          ...candidateChildOption,
                                          label: event.target.value,
                                        }
                                      : candidateChildOption,
                                  ),
                                },
                        })
                      }
                      placeholder="Short nested option label"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Subtext</p>
                    <Textarea
                      rows={2}
                      value={childOption.description ?? ''}
                      onChange={(event) =>
                        updateOptionChildQuestion({
                          roundId: params.roundId,
                          questionId: params.questionId,
                          optionId: params.option.id,
                          shouldReindex: false,
                          updater: (currentChildQuestion) =>
                            currentChildQuestion === null
                              ? currentChildQuestion
                              : {
                                  ...currentChildQuestion,
                                  options: currentChildQuestion.options.map((candidateChildOption) =>
                                    candidateChildOption.id === childOption.id
                                      ? {
                                          ...candidateChildOption,
                                          description: event.target.value,
                                        }
                                      : candidateChildOption,
                                  ),
                                },
                        })
                      }
                      placeholder="Optional supporting text shown below the nested option"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderOptionPresentationEditor(params: {
    readonly embedded?: boolean;
    readonly option: DiagnosticTemplateOptionValue;
    readonly questionId: string;
    readonly question: DiagnosticTemplateQuestionValue;
    readonly roundId: string;
  }): ReactElement {
    const shouldShowExampleBullets = params.question.type === 'multiple-choice';
    const shouldShowPanelTitle = params.question.type === 'nested-options';
    const exampleBulletsValue = params.option.presentation.exampleBullets.join('\n');
    const isEmbedded = params.embedded === true;
    return (
      <div className={isEmbedded ? 'space-y-3' : 'rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4'}>
        <div className="space-y-1">
          <p className={isEmbedded ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-medium text-foreground'}>
            Card presentation
          </p>
          <p className="text-xs text-muted-foreground">
            {isEmbedded
              ? 'Customer-facing card copy; does not change the saved answer value.'
              : 'These fields shape the customer-facing card without changing the saved answer value.'}
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <label htmlFor={`option-icon-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
              Icon name
            </label>
            <Input
              id={`option-icon-${params.option.id}`}
              value={params.option.presentation.icon ?? ''}
              onChange={(event) =>
                updateQuestionOption({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (option) => ({
                    ...option,
                    presentation: {
                      ...option.presentation,
                      icon: event.target.value,
                    },
                  }),
                })
              }
              placeholder="Example: TrendingUp"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`option-badge-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
              Badge text
            </label>
            <Input
              id={`option-badge-${params.option.id}`}
              value={params.option.presentation.badgeText ?? ''}
              onChange={(event) =>
                updateQuestionOption({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (option) => ({
                    ...option,
                    presentation: {
                      ...option.presentation,
                      badgeText: event.target.value,
                    },
                  }),
                })
              }
              placeholder="Optional badge such as NEW"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`option-eyebrow-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
              Eyebrow
            </label>
            <Input
              id={`option-eyebrow-${params.option.id}`}
              value={params.option.presentation.eyebrow ?? ''}
              onChange={(event) =>
                updateQuestionOption({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (option) => ({
                    ...option,
                    presentation: {
                      ...option.presentation,
                      eyebrow: event.target.value,
                    },
                  }),
                })
              }
              placeholder="Optional small heading above the title"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`option-title-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
              Card title override
            </label>
            <Input
              id={`option-title-${params.option.id}`}
              value={params.option.presentation.title ?? ''}
              onChange={(event) =>
                updateQuestionOption({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (option) => ({
                    ...option,
                    presentation: {
                      ...option.presentation,
                      title: event.target.value,
                    },
                  }),
                })
              }
              placeholder="Shown to customers if different from the answer label"
            />
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <label htmlFor={`option-supporting-text-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
              Supporting text override
            </label>
            <Textarea
              id={`option-supporting-text-${params.option.id}`}
              rows={3}
              value={params.option.presentation.supportingText ?? ''}
              onChange={(event) =>
                updateQuestionOption({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (option) => ({
                    ...option,
                    presentation: {
                      ...option.presentation,
                      supportingText: event.target.value,
                    },
                  }),
                })
              }
              placeholder="Optional card copy shown under the title."
            />
          </div>
          {shouldShowPanelTitle ? (
            <div className="space-y-2">
              <label htmlFor={`option-panel-title-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
                Nested panel title
              </label>
              <Input
                id={`option-panel-title-${params.option.id}`}
                value={params.option.presentation.panelTitle ?? ''}
                onChange={(event) =>
                  updateQuestionOption({
                    roundId: params.roundId,
                    questionId: params.questionId,
                    optionId: params.option.id,
                    shouldReindex: false,
                    updater: (option) => ({
                      ...option,
                      presentation: {
                        ...option.presentation,
                        panelTitle: event.target.value,
                      },
                    }),
                  })
                }
                placeholder="Optional title shown in the right-side nested panel"
              />
            </div>
          ) : null}
        </div>
        {shouldShowExampleBullets ? (
          <div className="mt-3 space-y-2">
            <label htmlFor={`option-examples-${params.option.id}`} className="text-xs font-medium text-muted-foreground">
              Example bullets
            </label>
            <Textarea
              id={`option-examples-${params.option.id}`}
              rows={4}
              value={exampleBulletsValue}
              onChange={(event) =>
                updateQuestionOption({
                  roundId: params.roundId,
                  questionId: params.questionId,
                  optionId: params.option.id,
                  shouldReindex: false,
                  updater: (option) => ({
                    ...option,
                    presentation: {
                      ...option.presentation,
                      exampleBullets: parseExampleBulletsInput(event.target.value),
                    },
                  }),
                })
              }
              placeholder={'One example per line\nCustomers are leaving\nSales are delayed'}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Customer diagnostic"
        title={isEditorMode ? 'Edit diagnostic template' : 'Diagnostic templates'}
        description={
          isEditorMode
            ? 'Refine the customer-facing fallback flow on its own page, then save when you are ready to publish updates.'
            : 'Build the structured question flow customers will see when AI Diagnostic is off. Keep one template active at a time.'
        }
        actions={
          isEditorMode ? (
            <Button asChild type="button" variant="outline">
              <Link href={listHref}>Back to templates</Link>
            </Button>
          ) : (
            <Button type="button" onClick={() => void executeCreateTemplate()} disabled={isCreating}>
              <Plus className="size-4" aria-hidden />
              {isCreating ? 'Creating…' : 'Create template'}
            </Button>
          )
        }
      />
      {errorMessage !== null ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      ) : null}
      {statusMessage !== null ? (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>{statusMessage}</p>
        </div>
      ) : null}
      <div className={cn('grid gap-6', isEditorMode ? 'grid-cols-1' : 'xl:grid-cols-[320px_minmax(0,1fr)]')}>
        {!isEditorMode ? (
          <section className="rounded-3xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-col gap-4 border-b border-border px-2 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Templates</h2>
                <p className="text-sm text-muted-foreground">
                  Manage every template from the table, then use the editor to refine the selected one.
                </p>
              </div>
              <Button type="button" onClick={executeOpenCreateForm} disabled={isCreating}>
                <Plus className="size-4" aria-hidden />
                New template
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={templateSearchValue}
                onChange={(event) => setTemplateSearchValue(event.target.value)}
                placeholder="Search template name"
                className="pl-9"
                aria-label="Search templates"
              />
            </div>
            {isCreateFormOpen ? (
              <form
                className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void executeCreateTemplate(newTemplateName);
                }}
              >
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="new-diagnostic-template-name" className="text-sm font-medium text-foreground">
                      New template name
                    </label>
                    <Input
                      id="new-diagnostic-template-name"
                      value={newTemplateName}
                      onChange={(event) => setNewTemplateName(event.target.value)}
                      placeholder="Example: Managed services intake"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave this blank if you want the system to generate a default name.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateFormOpen(false);
                        setNewTemplateName('');
                      }}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Creating…' : 'Create template'}
                    </Button>
                  </div>
                </div>
              </form>
            ) : null}
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3 px-2">
              <p className="text-sm text-muted-foreground">
                {filteredTemplateCount} of {templates.length} templates
              </p>
              <p className="text-xs text-muted-foreground">Click a row to open it in the editor.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  {templateTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left align-middle font-medium text-muted-foreground"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {templateTable.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={templateTableColumns.length} className="px-4 py-8 text-center text-muted-foreground">
                        {templates.length === 0
                          ? 'Create your first template to start managing rounds, questions, and options.'
                          : 'No templates match your search.'}
                      </td>
                    </tr>
                  ) : (
                    templateTable.getRowModel().rows.map((row) => {
                      const isSelected = row.original.id === selectedTemplateId;
                      return (
                        <tr
                          key={row.id}
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={(event) => {
                            if (event.defaultPrevented || isInteractiveRowTarget(event.target)) {
                              return;
                            }
                            executeSelectTemplate(row.original.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.defaultPrevented || isInteractiveRowTarget(event.target)) {
                              return;
                            }
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              executeSelectTemplate(row.original.id);
                            }
                          }}
                          className={cn(
                            'border-b border-border outline-none transition-colors focus-visible:bg-primary/5',
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/40',
                          )}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 align-middle">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <p className="text-sm text-muted-foreground">
                Page {templateTable.getState().pagination.pageIndex + 1} of {Math.max(1, templateTable.getPageCount())}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => templateTable.previousPage()}
                  disabled={!templateTable.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => templateTable.nextPage()}
                  disabled={!templateTable.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
          </section>
        ) : null}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs">
          {selectedTemplate === null ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 text-center text-sm text-muted-foreground">
              {isEditorMode ? 'This template is no longer available.' : 'Select a template or create a new one.'}
            </div>
          ) : (
            <div
              className={cn(
                'space-y-6',
                isEditorMode && selectedTemplate.rounds.length > 0
                  ? 'xl:grid xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start xl:gap-6 xl:space-y-0'
                  : undefined,
              )}
            >
              {isEditorMode && selectedTemplate.rounds.length > 0 ? (
                <nav
                  aria-label="Diagnostic template outline"
                  className="rounded-2xl border border-border bg-muted/20 p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Rounds and questions</p>
                    <p className="text-xs text-muted-foreground">
                      Click any item to jump directly to that section in the editor.
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedTemplate.rounds.map((round, roundIndex) => {
                      const roundSectionId = buildTemplateSectionId({
                        kind: 'round',
                        entityId: round.id,
                      });
                      return (
                        <div key={round.id} className="space-y-2">
                          <div className="flex items-start gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto min-w-0 flex-1 justify-start rounded-xl px-3 py-2 text-left"
                              onClick={() => executeScrollToTemplateSection(roundSectionId)}
                            >
                              <span className="flex min-w-0 flex-col items-start">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {formatTemplateOutlineRoundLabel({
                                    round,
                                    roundIndex,
                                  })}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {round.questions.length} {round.questions.length === 1 ? 'question' : 'questions'}
                                </span>
                              </span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => executeAddQuestionToRound(round.id)}
                            >
                              <Plus className="size-4" aria-hidden />
                              Question
                            </Button>
                          </div>
                          {round.questions.length > 0 ? (
                            <div className="ml-4 space-y-1 border-l border-border pl-3">
                              {round.questions.map((question, questionIndex) => {
                                const questionSectionId = buildTemplateSectionId({
                                  kind: 'question',
                                  entityId: question.id,
                                });
                                return (
                                  <div key={question.id} className="flex items-start gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-auto min-w-0 flex-1 justify-start rounded-xl px-3 py-2 text-left text-sm"
                                      onClick={() => executeScrollToTemplateSection(questionSectionId)}
                                    >
                                      <span className="truncate">
                                        {formatTemplateOutlineQuestionLabel({
                                          question,
                                          questionIndex,
                                        })}
                                      </span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="shrink-0"
                                      onClick={() =>
                                        executeAddOptionToQuestion({
                                          roundId: round.id,
                                          questionId: question.id,
                                        })
                                      }
                                    >
                                      <Plus className="size-4" aria-hidden />
                                      Option
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={executeAddRound}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add round
                    </Button>
                  </div>
                </nav>
              ) : null}
              <div className="space-y-6">
                <div className="border-b border-border pb-6">
                  <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor="diagnostic-template-name" className="text-sm font-medium text-foreground">
                      Template name
                    </label>
                    <Input
                      id="diagnostic-template-name"
                      value={selectedTemplate.name}
                      onChange={(event) =>
                        updateSelectedTemplate(
                          (template) => ({
                            ...template,
                            name: event.target.value,
                          }),
                          { shouldReindex: false },
                        )
                      }
                      placeholder="Example: SMB intake template"
                    />
                    <p className="text-xs text-muted-foreground">
                      The active template is what customer-facing quiz flows will use whenever AI Diagnostic is off.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {selectedTemplate.rounds.map((round, roundIndex) => (
                    <article
                      key={round.id}
                      id={buildTemplateSectionId({
                        kind: 'round',
                        entityId: round.id,
                      })}
                      tabIndex={-1}
                      className="scroll-mt-28 rounded-2xl border border-border bg-background p-4 shadow-xs outline-none"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">Round {roundIndex + 1}</p>
                          <p className="text-xs text-muted-foreground">
                            Customers see each round in sequence when template mode is active.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateSelectedTemplate((template) => ({
                                ...template,
                                rounds: moveArrayItem(template.rounds, roundIndex, roundIndex - 1),
                              }))
                            }
                            disabled={roundIndex === 0}
                          >
                            Move up
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateSelectedTemplate((template) => ({
                                ...template,
                                rounds: moveArrayItem(template.rounds, roundIndex, roundIndex + 1),
                              }))
                            }
                            disabled={roundIndex >= selectedTemplate.rounds.length - 1}
                          >
                            Move down
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateSelectedTemplate((template) => ({
                                ...template,
                                rounds: template.rounds.filter((candidate) => candidate.id !== round.id),
                              }))
                            }
                          >
                            Remove round
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <label htmlFor={`round-title-${round.id}`} className="text-sm font-medium text-foreground">
                            Round title
                          </label>
                          <Input
                            id={`round-title-${round.id}`}
                            value={round.title}
                            onChange={(event) =>
                              updateSelectedTemplate(
                                (template) => ({
                                  ...template,
                                  rounds: template.rounds.map((candidate) =>
                                    candidate.id === round.id
                                      ? {
                                          ...candidate,
                                          title: event.target.value,
                                        }
                                      : candidate,
                                  ),
                                }),
                                { shouldReindex: false },
                              )
                            }
                            placeholder="Example: Environment and symptoms"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor={`round-guidance-${round.id}`} className="text-sm font-medium text-foreground">
                            Round subtext
                          </label>
                          <Textarea
                            id={`round-guidance-${round.id}`}
                            rows={3}
                            value={round.guidance ?? ''}
                            onChange={(event) =>
                              updateSelectedTemplate(
                                (template) => ({
                                  ...template,
                                  rounds: template.rounds.map((candidate) =>
                                    candidate.id === round.id
                                      ? {
                                          ...candidate,
                                          guidance: event.target.value,
                                        }
                                      : candidate,
                                  ),
                                }),
                                { shouldReindex: false },
                              )
                            }
                            placeholder="Optional supporting text shown before the first question in this round."
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        {renderVisibilityRuleEditor({
                          availableQuestions: buildAvailableVisibilitySourceQuestions({
                            template: selectedTemplate,
                            roundId: round.id,
                          }),
                          label: 'Round visibility',
                          description: 'Use this to skip the entire round unless earlier answers match selected options.',
                          rule: round.showWhen,
                          onChange: (nextRule) =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: template.rounds.map((candidateRound) =>
                                candidateRound.id === round.id
                                  ? {
                                      ...candidateRound,
                                      showWhen: nextRule,
                                    }
                                  : candidateRound,
                              ),
                            })),
                        })}
                      </div>
                      <div className="mt-6 space-y-3">
                        {round.questions.map((question, questionIndex) => (
                          <div
                            key={question.id}
                            id={buildTemplateSectionId({
                              kind: 'question',
                              entityId: question.id,
                            })}
                            tabIndex={-1}
                            className="scroll-mt-28 rounded-2xl border border-border bg-card p-4 outline-none"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  Question {questionIndex + 1}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Keep options short so customers can tap quickly on mobile.
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateSelectedTemplate((template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidate) =>
                                        candidate.id === round.id
                                          ? {
                                              ...candidate,
                                              questions: moveArrayItem(
                                                candidate.questions,
                                                questionIndex,
                                                questionIndex - 1,
                                              ),
                                            }
                                          : candidate,
                                      ),
                                    }))
                                  }
                                  disabled={questionIndex === 0}
                                >
                                  Move up
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateSelectedTemplate((template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidate) =>
                                        candidate.id === round.id
                                          ? {
                                              ...candidate,
                                              questions: moveArrayItem(
                                                candidate.questions,
                                                questionIndex,
                                                questionIndex + 1,
                                              ),
                                            }
                                          : candidate,
                                      ),
                                    }))
                                  }
                                  disabled={questionIndex >= round.questions.length - 1}
                                >
                                  Move down
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateSelectedTemplate((template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidate) =>
                                        candidate.id === round.id
                                          ? {
                                              ...candidate,
                                              questions: candidate.questions.filter(
                                                (candidateQuestion) => candidateQuestion.id !== question.id,
                                              ),
                                            }
                                          : candidate,
                                      ),
                                    }))
                                  }
                                >
                                  Remove question
                                </Button>
                              </div>
                            </div>
                            <div className="mt-4 space-y-2">
                              <label htmlFor={`question-prompt-${question.id}`} className="text-sm font-medium text-foreground">
                                Prompt
                              </label>
                              <Input
                                id={`question-prompt-${question.id}`}
                                value={question.prompt}
                                onChange={(event) =>
                                  updateSelectedTemplate(
                                    (template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidateRound) =>
                                        candidateRound.id === round.id
                                          ? {
                                              ...candidateRound,
                                              questions: candidateRound.questions.map((candidateQuestion) =>
                                                candidateQuestion.id === question.id
                                                  ? {
                                                      ...candidateQuestion,
                                                      prompt: event.target.value,
                                                    }
                                                  : candidateQuestion,
                                              ),
                                            }
                                          : candidateRound,
                                      ),
                                    }),
                                    { shouldReindex: false },
                                  )
                                }
                                placeholder="Example: Which part of the system is hurting most?"
                              />
                            </div>
                            <div className="mt-4 space-y-2">
                              <label htmlFor={`question-description-${question.id}`} className="text-sm font-medium text-foreground">
                                Question subtext
                              </label>
                              <Textarea
                                id={`question-description-${question.id}`}
                                rows={2}
                                value={question.description ?? ''}
                                onChange={(event) =>
                                  updateSelectedTemplate(
                                    (template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidateRound) =>
                                        candidateRound.id === round.id
                                          ? {
                                              ...candidateRound,
                                              questions: candidateRound.questions.map((candidateQuestion) =>
                                                candidateQuestion.id === question.id
                                                  ? {
                                                      ...candidateQuestion,
                                                      description: event.target.value,
                                                    }
                                                  : candidateQuestion,
                                              ),
                                            }
                                          : candidateRound,
                                      ),
                                    }),
                                    { shouldReindex: false },
                                  )
                                }
                                placeholder="Optional supporting text shown below the question prompt."
                              />
                            </div>
                            <div className="mt-4">
                              {renderVisibilityRuleEditor({
                                availableQuestions: buildAvailableVisibilitySourceQuestions({
                                  template: selectedTemplate,
                                  roundId: round.id,
                                  targetQuestionId: question.id,
                                }),
                                label: 'Question visibility',
                                description:
                                  'Only show this question when an earlier question includes the selected option(s).',
                                rule: question.showWhen,
                                onChange: (nextRule) =>
                                  updateSelectedTemplate((template) => ({
                                    ...template,
                                    rounds: template.rounds.map((candidateRound) =>
                                      candidateRound.id === round.id
                                        ? {
                                            ...candidateRound,
                                            questions: candidateRound.questions.map((candidateQuestion) =>
                                              candidateQuestion.id === question.id
                                                ? {
                                                    ...candidateQuestion,
                                                    showWhen: nextRule,
                                                  }
                                                : candidateQuestion,
                                            ),
                                          }
                                        : candidateRound,
                                    ),
                                  })),
                              })}
                            </div>
                            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                              {renderQuestionTypeButtons({
                                currentType: question.type,
                                label: 'Question type',
                                onSelect: (questionType) =>
                                  updateSelectedTemplate(
                                    (template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidateRound) =>
                                        candidateRound.id === round.id
                                          ? {
                                              ...candidateRound,
                                              questions: candidateRound.questions.map((candidateQuestion) =>
                                                candidateQuestion.id === question.id
                                                  ? {
                                                      ...candidateQuestion,
                                                      type: questionType,
                                                      rankedOptionLimit:
                                                        questionType === 'ranked-options'
                                                          ? candidateQuestion.rankedOptionLimit ?? 3
                                                          : null,
                                                      selectionMode:
                                                        questionType === 'ranked-options'
                                                          ? 'multiple'
                                                          : candidateQuestion.selectionMode,
                                                      options:
                                                        questionType === 'ranked-options'
                                                          ? candidateQuestion.options.map((candidateOption) => ({
                                                              ...candidateOption,
                                                              requestDetailNoteWhenSelected: false,
                                                            }))
                                                          : candidateQuestion.options,
                                                    }
                                                  : candidateQuestion,
                                              ),
                                            }
                                          : candidateRound,
                                      ),
                                    }),
                                    { shouldReindex: false },
                                  ),
                              })}
                              <p className="mt-2 text-xs text-muted-foreground">
                                Choose how this question should render in the web quiz.
                              </p>
                              {question.type === 'ranked-options' ? (
                                <div className="mt-4 space-y-2">
                                  <label
                                    htmlFor={`question-ranked-limit-${question.id}`}
                                    className="text-sm font-medium text-foreground"
                                  >
                                    Ranked top-N limit
                                  </label>
                                  <Input
                                    id={`question-ranked-limit-${question.id}`}
                                    type="number"
                                    min={2}
                                    max={10}
                                    value={question.rankedOptionLimit ?? 3}
                                    onChange={(event) =>
                                      updateSelectedTemplate(
                                        (template) => ({
                                          ...template,
                                          rounds: template.rounds.map((candidateRound) =>
                                            candidateRound.id === round.id
                                              ? {
                                                  ...candidateRound,
                                                  questions: candidateRound.questions.map((candidateQuestion) =>
                                                    candidateQuestion.id === question.id
                                                      ? {
                                                          ...candidateQuestion,
                                                          rankedOptionLimit: Math.max(
                                                            2,
                                                            Math.min(
                                                              10,
                                                              Number.parseInt(event.target.value || '3', 10) || 3,
                                                            ),
                                                          ),
                                                        }
                                                      : candidateQuestion,
                                                  ),
                                                }
                                              : candidateRound,
                                          ),
                                        }),
                                        { shouldReindex: false },
                                      )
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Customers must rank exactly this many options before they can continue.
                                  </p>
                                </div>
                              ) : null}
                            </div>
                            {question.type !== 'ranked-options' ? (
                              <div className="mt-4">
                                {renderSelectionModeButtons({
                                  currentMode: question.selectionMode,
                                  label: 'Question selection mode',
                                  onSelect: (selectionMode) =>
                                    updateSelectedTemplate((template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidateRound) =>
                                        candidateRound.id === round.id
                                          ? {
                                              ...candidateRound,
                                              questions: candidateRound.questions.map((candidateQuestion) =>
                                                candidateQuestion.id === question.id
                                                  ? {
                                                      ...candidateQuestion,
                                                      selectionMode,
                                                      options:
                                                        selectionMode === 'single'
                                                          ? candidateQuestion.options
                                                          : candidateQuestion.options.map((candidateOption) => ({
                                                              ...candidateOption,
                                                              requestDetailNoteWhenSelected: false,
                                                            })),
                                                    }
                                                  : candidateQuestion,
                                              ),
                                            }
                                          : candidateRound,
                                      ),
                                    })),
                                })}
                              </div>
                            ) : (
                              <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                Ranked questions always use multiple selections so customers can order their top choices.
                              </div>
                            )}
                            <div className="mt-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">Options</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateSelectedTemplate((template) => ({
                                      ...template,
                                      rounds: template.rounds.map((candidateRound) =>
                                        candidateRound.id === round.id
                                          ? {
                                              ...candidateRound,
                                              questions: candidateRound.questions.map((candidateQuestion) =>
                                                candidateQuestion.id === question.id
                                                  ? {
                                                      ...candidateQuestion,
                                                      options: [
                                                        ...candidateQuestion.options,
                                                        createDraftOption(candidateQuestion.options.length),
                                                      ],
                                                    }
                                                  : candidateQuestion,
                                              ),
                                            }
                                          : candidateRound,
                                      ),
                                    }))
                                  }
                                >
                                  <Plus className="size-4" aria-hidden />
                                  Add option
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {question.options.map((option, optionIndex) => (
                                  <StaticOptionRow
                                    key={option.id}
                                    optionIndex={optionIndex}
                                    optionsCount={question.options.length}
                                    onMoveUp={() =>
                                      updateSelectedTemplate((template) => ({
                                        ...template,
                                        rounds: template.rounds.map((candidateRound) =>
                                          candidateRound.id === round.id
                                            ? {
                                                ...candidateRound,
                                                questions: candidateRound.questions.map((candidateQuestion) =>
                                                  candidateQuestion.id === question.id
                                                    ? {
                                                        ...candidateQuestion,
                                                        options: moveArrayItem(
                                                          candidateQuestion.options,
                                                          optionIndex,
                                                          optionIndex - 1,
                                                        ),
                                                      }
                                                    : candidateQuestion,
                                                ),
                                              }
                                            : candidateRound,
                                        ),
                                      }))
                                    }
                                    onMoveDown={() =>
                                      updateSelectedTemplate((template) => ({
                                        ...template,
                                        rounds: template.rounds.map((candidateRound) =>
                                          candidateRound.id === round.id
                                            ? {
                                                ...candidateRound,
                                                questions: candidateRound.questions.map((candidateQuestion) =>
                                                  candidateQuestion.id === question.id
                                                    ? {
                                                        ...candidateQuestion,
                                                        options: moveArrayItem(
                                                          candidateQuestion.options,
                                                          optionIndex,
                                                          optionIndex + 1,
                                                        ),
                                                      }
                                                    : candidateQuestion,
                                                ),
                                              }
                                            : candidateRound,
                                        ),
                                      }))
                                    }
                                    onRemove={() =>
                                      updateSelectedTemplate((template) => ({
                                        ...template,
                                        rounds: template.rounds.map((candidateRound) =>
                                          candidateRound.id === round.id
                                            ? {
                                                ...candidateRound,
                                                questions: candidateRound.questions.map((candidateQuestion) =>
                                                  candidateQuestion.id === question.id
                                                    ? {
                                                        ...candidateQuestion,
                                                        options: candidateQuestion.options.filter(
                                                          (candidateOption) => candidateOption.id !== option.id,
                                                        ),
                                                      }
                                                    : candidateQuestion,
                                                ),
                                              }
                                            : candidateRound,
                                        ),
                                      }))
                                    }
                                  >
                                    <Tabs defaultValue="basics" className="w-full">
                                      <TabsList
                                        aria-label={`Option ${optionIndex + 1} settings`}
                                        className="mb-0 flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg bg-muted/60 p-1"
                                      >
                                        <TabsTrigger value="basics">Basics</TabsTrigger>
                                        <TabsTrigger value="visibility">Visibility</TabsTrigger>
                                        <TabsTrigger value="card">Card</TabsTrigger>
                                        {question.type === 'nested-options' ? (
                                          <TabsTrigger value="followup">Follow-up</TabsTrigger>
                                        ) : null}
                                      </TabsList>
                                      <TabsContent value="basics" className="mt-3 space-y-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">Label</p>
                                            <Input
                                              value={option.label}
                                              onChange={(event) =>
                                                updateQuestionOption({
                                                  roundId: round.id,
                                                  questionId: question.id,
                                                  optionId: option.id,
                                                  shouldReindex: false,
                                                  updater: (candidateOption) => ({
                                                    ...candidateOption,
                                                    label: event.target.value,
                                                  }),
                                                })
                                              }
                                              placeholder="Short tap label"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">Subtext</p>
                                            <Textarea
                                              value={option.description ?? ''}
                                              onChange={(event) =>
                                                updateQuestionOption({
                                                  roundId: round.id,
                                                  questionId: question.id,
                                                  optionId: option.id,
                                                  shouldReindex: false,
                                                  updater: (candidateOption) => ({
                                                    ...candidateOption,
                                                    description: event.target.value,
                                                  }),
                                                })
                                              }
                                              placeholder="Optional supporting text below the label"
                                              rows={2}
                                              className="min-h-18 resize-y"
                                            />
                                          </div>
                                        </div>
                                        {question.selectionMode === 'single' ? (
                                          <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-3">
                                            <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
                                              <input
                                                type="checkbox"
                                                className="mt-1 size-4 shrink-0 rounded border-input"
                                                checked={option.requestDetailNoteWhenSelected}
                                                onChange={(event) => {
                                                  const checked = event.target.checked;
                                                  updateSelectedTemplate((template) => ({
                                                    ...template,
                                                    rounds: template.rounds.map((candidateRound) =>
                                                      candidateRound.id !== round.id
                                                        ? candidateRound
                                                        : {
                                                            ...candidateRound,
                                                            questions: candidateRound.questions.map((candidateQuestion) =>
                                                              candidateQuestion.id !== question.id
                                                                ? candidateQuestion
                                                                : {
                                                                    ...candidateQuestion,
                                                                    options: candidateQuestion.options.map((candidateOption) => {
                                                                      if (candidateOption.id === option.id) {
                                                                        return {
                                                                          ...candidateOption,
                                                                          requestDetailNoteWhenSelected: checked,
                                                                        };
                                                                      }
                                                                      if (checked) {
                                                                        return {
                                                                          ...candidateOption,
                                                                          requestDetailNoteWhenSelected: false,
                                                                        };
                                                                      }
                                                                      return candidateOption;
                                                                    }),
                                                                  },
                                                            ),
                                                          },
                                                    ),
                                                  }));
                                                }}
                                              />
                                              <span>
                                                <span className="font-medium">Detail textbox when this option is selected</span>
                                                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                                  Single-select only. One option per question. When on, customers see
                                                  &quot;Your exact answer&quot; only while this option is selected, and they must
                                                  fill it before continuing.
                                                </span>
                                              </span>
                                            </label>
                                          </div>
                                        ) : null}
                                      </TabsContent>
                                      <TabsContent value="visibility" className="mt-3">
                                        {renderOptionVisibilityRuleEditor({
                                          embedded: true,
                                          availableSources: buildAvailableOptionVisibilitySources({
                                            template: selectedTemplate,
                                            roundId: round.id,
                                            question,
                                            optionId: option.id,
                                          }),
                                          rule: option.showWhen,
                                          onChange: (nextRule) =>
                                            updateQuestionOption({
                                              roundId: round.id,
                                              questionId: question.id,
                                              optionId: option.id,
                                              updater: (candidateOption) => ({
                                                ...candidateOption,
                                                showWhen: nextRule,
                                              }),
                                            }),
                                        })}
                                      </TabsContent>
                                      <TabsContent value="card" className="mt-3">
                                        {renderOptionPresentationEditor({
                                          embedded: true,
                                          roundId: round.id,
                                          question,
                                          questionId: question.id,
                                          option,
                                        })}
                                      </TabsContent>
                                      {question.type === 'nested-options' ? (
                                        <TabsContent value="followup" className="mt-3">
                                          {renderChildQuestionEditor({
                                            embedded: true,
                                            roundId: round.id,
                                            questionId: question.id,
                                            option,
                                          })}
                                        </TabsContent>
                                      ) : null}
                                    </Tabs>
                                  </StaticOptionRow>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: template.rounds.map((candidate) =>
                                candidate.id === round.id
                                  ? {
                                      ...candidate,
                                      questions: [...candidate.questions, createDraftQuestion(candidate.questions.length)],
                                    }
                                  : candidate,
                              ),
                            }))
                          }
                        >
                          <Plus className="size-4" aria-hidden />
                          Add question
                        </Button>
                      </div>
                    </article>
                  ))}
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={executeAddRound}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add round
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      {selectedTemplate !== null ? (
        <div className="sticky bottom-4 z-10">
          <div className="flex w-full flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => void executeActivateTemplate(selectedTemplate.id)}
              disabled={selectedTemplate.isActive || activatingTemplateId === selectedTemplate.id}
            >
              {activatingTemplateId === selectedTemplate.id ? 'Activating…' : 'Set active'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void executeDeleteTemplate(selectedTemplate.id)}
              disabled={deletingTemplateId === selectedTemplate.id}
            >
              <Trash2 className="size-4" aria-hidden />
              {deletingTemplateId === selectedTemplate.id ? 'Deleting…' : 'Delete'}
            </Button>
            <Button
              type="button"
              onClick={() => void executeSaveSelectedTemplate()}
              disabled={!hasDirtySelectedTemplate || isSaving}
            >
              <Save className="size-4" aria-hidden />
              {isSaving ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
