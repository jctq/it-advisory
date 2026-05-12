'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Check,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Gauge,
  HelpCircle,
  Lightbulb,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PublicDiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import {
  buildNextTemplateRoundFromState,
  buildTemplateDiagnosticOutcome,
} from '@/lib/marketing/diagnostic-template-flow';
import type { DiagnosticRoundDebugMeta } from '@/domain/types';
import { extractDiagnosticRoundDebugFromResponse } from '@/lib/marketing/diagnostic-cache-debug';
import {
  type CompletedRoundBundle,
  type DiagnosticQuestionBlock,
  type DiagnosticQuestionOption,
  type DiagnosticQuestionSelection,
  buildDiagnosticAnswerLookup,
  createEmptyDiagnosticQuestionSelection,
  findNextVisibleQuestionIndex,
  getVisibleQuestionOptions,
  getVisibleQuestionIndexes,
  type GuidedDiagnosticOutcome,
  type GuidedDiagnosticV1,
  buildDiagnosticTranscript,
  normalizeDiagnosticOptions,
  pruneHiddenAnswers,
  toggleChildQuestionOptionSelection,
  toggleQuestionOptionSelection,
  toApiRoundsFromBundles,
  validateGuidedQuestionResponse,
} from '@/lib/marketing/guided-diagnostic-types';
import { getSituationSeed } from '@/lib/marketing/situation-options';
import { cn } from '@/lib/utils';

const MIN_PROMPT_LENGTH = 8;
const MAX_ANSWER_NOTE_LENGTH = 2000;
const SITUATION_SEED_CHIPS: readonly string[] = getSituationSeed();
const DIAGNOSTIC_CONFIG_API_URL = '/api/quiz/diagnostic-config';
const DIAGNOSTIC_ROUND_API_URL = '/api/quiz/diagnostic-round';
const DIAGNOSTIC_TEMPLATE_API_URL = '/api/quiz/diagnostic-template';
const DIAGNOSTIC_TEMPLATE_SUMMARY_API_URL = '/api/quiz/diagnostic-template-summary';

function togglePromptWithSeed(currentPrompt: string, phrase: string): string {
  const trimmedCurrent = currentPrompt.trim();
  if (trimmedCurrent.length === 0) {
    return phrase;
  }
  const lines = trimmedCurrent.split(/\r?\n/).map((line) => line.trim());
  const matchIndex = lines.findIndex((line) => line.toLowerCase() === phrase.toLowerCase());
  if (matchIndex >= 0) {
    const remaining = lines.filter((_, index) => index !== matchIndex).filter((line) => line.length > 0);
    return remaining.join('\n');
  }
  return `${trimmedCurrent}\n${phrase}`;
}

function isSeedActiveInPrompt(prompt: string, phrase: string): boolean {
  const lower = prompt.toLowerCase();
  return lower.includes(phrase.toLowerCase());
}

type DiagnosticDebugLogEntry = {
  readonly id: string;
  readonly label: string;
  readonly meta: DiagnosticRoundDebugMeta;
};

type DiagnosticRoundApiBody = {
  readonly complete?: boolean;
  readonly questions?: DiagnosticQuestionBlock[];
  readonly guidance?: string | null;
  readonly mappedSituation?: string;
  readonly summaryForAdvisor?: string;
  readonly error?: string;
  readonly code?: string;
  readonly details?: string;
  readonly _diagnosticDebug?: DiagnosticRoundDebugMeta;
};

function DiagnosticCacheDebugPanel(props: {
  readonly showDebugUi: boolean;
  readonly entries: readonly DiagnosticDebugLogEntry[];
  readonly onClear: () => void;
}): ReactElement | null {
  if (!props.showDebugUi || props.entries.length === 0) {
    return null;
  }
  const callWord = props.entries.length === 1 ? 'call' : 'calls';
  return (
    <details className="mb-6 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/6 px-4 py-3 text-left">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100">
        Diagnostic cache debug ({props.entries.length} API {callWord})
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Each row is one response from <span className="font-medium text-foreground">/api/quiz/diagnostic-round</span>.
          <span className="font-medium text-emerald-700 dark:text-emerald-400"> Cache</span> means the response came from
          MongoDB (exact hash match or semantic vector neighbor);{' '}
          <span className="font-medium text-sky-700 dark:text-sky-400">AI</span> means OpenAI generated it (then stored
          when applicable).
        </p>
        <ul className="space-y-2 text-[11px] leading-relaxed">
          {props.entries.map((entry) => (
            <li key={entry.id} className="rounded-lg bg-background/80 px-3 py-2 font-mono shadow-xs">
              <div className="font-sans text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  <span className="text-muted-foreground">Match:</span>{' '}
                  <span className="font-medium text-foreground">
                    {entry.meta.matchTier === 'exact'
                      ? 'Exact hash'
                      : entry.meta.matchTier === 'semantic'
                        ? 'Semantic (vector)'
                        : 'AI generation'}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Source:</span>{' '}
                  <span
                    className={
                      entry.meta.source === 'cache'
                        ? 'font-medium text-emerald-700 dark:text-emerald-400'
                        : 'font-medium text-sky-700 dark:text-sky-400'
                    }
                  >
                    {entry.meta.source === 'cache' ? 'MongoDB cache' : 'AI (OpenAI)'}
                  </span>
                </span>
                {entry.meta.model !== null ? (
                  <span>
                    <span className="text-muted-foreground">Model:</span> {entry.meta.model}
                  </span>
                ) : null}
                <span>
                  <span className="text-muted-foreground">Cache version:</span> {entry.meta.cacheVersion}
                </span>
                {entry.meta.semanticScore !== null ? (
                  <span>
                    <span className="text-muted-foreground">Vector score:</span>{' '}
                    {entry.meta.semanticScore.toFixed(4)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 break-all text-muted-foreground">
                <span className="text-muted-foreground">Document hash:</span> {entry.meta.threadHash}
              </div>
              {entry.meta.queryThreadHash !== entry.meta.threadHash ? (
                <div className="mt-1 break-all text-muted-foreground">
                  <span className="text-muted-foreground">Query hash:</span> {entry.meta.queryThreadHash}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={props.onClear}
          className="text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear log
        </button>
      </div>
    </details>
  );
}

const OPTION_ICON_COMPONENTS = {
  AlertTriangle,
  BarChart3,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Gauge,
  HelpCircle,
  Lightbulb,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Wrench,
  Zap,
} as const satisfies Record<string, LucideIcon>;

const OPTION_ACCENT_CLASS_NAMES = [
  'bg-emerald-50 text-emerald-600',
  'bg-amber-50 text-amber-600',
  'bg-indigo-50 text-indigo-600',
  'bg-rose-50 text-rose-600',
  'bg-cyan-50 text-cyan-600',
  'bg-violet-50 text-violet-600',
] as const;

function getDisplayOptionTitle(option: DiagnosticQuestionOption): string {
  return option.presentation.title?.trim() || option.label;
}

function getDisplayOptionSupportingText(option: DiagnosticQuestionOption): string | null {
  return option.presentation.supportingText?.trim() || option.description;
}

function hasSingleSelectCascade(question: DiagnosticQuestionBlock): boolean {
  return (
    question.selectionMode === 'single' &&
    question.options.some((option) => option.showWhen !== null && option.showWhen.sourceQuestionId === question.id)
  );
}

function getTerminalSelectedOptionId(selection: DiagnosticQuestionSelection): string | null {
  return selection.selectedOptionIds[selection.selectedOptionIds.length - 1] ?? null;
}

function getAccentClassName(optionIndex: number): string {
  return OPTION_ACCENT_CLASS_NAMES[optionIndex % OPTION_ACCENT_CLASS_NAMES.length] ?? OPTION_ACCENT_CLASS_NAMES[0];
}

function DiagnosticOptionIcon(props: {
  readonly iconName: string | null;
  readonly optionIndex: number;
}): ReactElement {
  const IconComponent =
    props.iconName !== null && props.iconName in OPTION_ICON_COMPONENTS
      ? OPTION_ICON_COMPONENTS[props.iconName as keyof typeof OPTION_ICON_COMPONENTS]
      : HelpCircle;
  return (
    <span className={cn('flex size-12 items-center justify-center rounded-full', getAccentClassName(props.optionIndex))}>
      <IconComponent className="size-6" aria-hidden />
    </span>
  );
}

function MultipleChoiceRoundRenderer(props: {
  readonly baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
  readonly onToggleChildOption: (parentOptionId: string, childOptionId: string) => void;
  readonly onToggleOption: (optionId: string) => void;
}): ReactElement {
  const visibleOptions = getVisibleQuestionOptions({
    baseAnswers: props.baseAnswers,
    question: props.question,
    selection: props.selection,
  });
  const supportsSingleSelectCascade = hasSingleSelectCascade(props.question);
  const terminalSelectedOptionId =
    props.question.selectionMode === 'single' ? getTerminalSelectedOptionId(props.selection) : null;
  return (
    <fieldset className="mt-8 space-y-5">
      <legend className="text-balance text-2xl font-semibold tracking-tight text-foreground">{props.question.prompt}</legend>
      {props.question.description !== null ? (
        <p className="text-pretty text-base text-muted-foreground">{props.question.description}</p>
      ) : null}
      <p className="text-sm font-medium text-muted-foreground">
        {props.question.selectionMode === 'multiple'
          ? 'Select one or more options.'
          : supportsSingleSelectCascade
            ? 'Choose one path. More choices may appear after your first selection.'
            : 'Select the option that fits best.'}
      </p>
      <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2" role="group">
        {visibleOptions.map((option, optionIndex) => {
          const isInSelectedPath = props.selection.selectedOptionIds.includes(option.id);
          const isSelected = terminalSelectedOptionId !== null ? terminalSelectedOptionId === option.id : isInSelectedPath;
          const supportingText = getDisplayOptionSupportingText(option);
          const selectedChildOptionIds = props.selection.childSelections[option.id] ?? [];
          return (
            <div key={`${props.question.id}-${option.id}`} className="space-y-3">
              <button
                type="button"
                onClick={() => props.onToggleOption(option.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex h-full w-full flex-col rounded-2xl border bg-card p-5 text-left shadow-xs transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : isInSelectedPath
                      ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <DiagnosticOptionIcon iconName={option.presentation.icon} optionIndex={optionIndex} />
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isInSelectedPath
                          ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-background text-transparent',
                    )}
                    aria-hidden
                  >
                    {isSelected ? <Check className="size-4" /> : isInSelectedPath ? <span className="size-2 rounded-full bg-primary" /> : <Check className="size-4" />}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {option.presentation.eyebrow !== null ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{option.presentation.eyebrow}</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{getDisplayOptionTitle(option)}</h3>
                    {option.presentation.badgeText !== null ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        {option.presentation.badgeText}
                      </span>
                    ) : null}
                  </div>
                  {supportingText !== null ? <p className="text-sm leading-6 text-muted-foreground">{supportingText}</p> : null}
                </div>
                {option.presentation.exampleBullets.length > 0 ? (
                  <div className="mt-5 border-t border-border/70 pt-4">
                    <p className="text-xs font-semibold text-primary">Examples:</p>
                    <ul className="mt-2 space-y-1 text-sm text-foreground">
                      {option.presentation.exampleBullets.map((exampleBullet) => (
                        <li key={`${option.id}-${exampleBullet}`} className="flex gap-2">
                          <span className="mt-2 size-1.5 rounded-full bg-foreground/70" aria-hidden />
                          <span>{exampleBullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </button>
              {isSelected && option.childQuestion !== null ? (
                <fieldset className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <legend className="px-1 text-sm font-semibold text-foreground">{option.childQuestion.prompt}</legend>
                  {option.childQuestion.description !== null ? (
                    <p className="text-sm text-muted-foreground">{option.childQuestion.description}</p>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    {option.childQuestion.options.map((childOption) => {
                      const isChildSelected = selectedChildOptionIds.includes(childOption.id);
                      return (
                        <button
                          key={`${option.childQuestion!.id}-${childOption.id}`}
                          type="button"
                          onClick={() => props.onToggleChildOption(option.id, childOption.id)}
                          className={cn(
                            'flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                            isChildSelected
                              ? 'border-primary bg-background ring-2 ring-primary/15'
                              : 'border-border bg-background/80 hover:border-primary/30',
                          )}
                        >
                          <span>
                            <span className="block text-sm font-medium text-foreground">{childOption.label}</span>
                            {childOption.description !== null ? (
                              <span className="mt-1 block text-xs text-muted-foreground">{childOption.description}</span>
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 flex size-5 items-center justify-center rounded-sm border',
                              isChildSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-transparent',
                            )}
                            aria-hidden
                          >
                            <Check className="size-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function NestedOptionsRoundRenderer(props: {
  readonly baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly guidance: string | null;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
  readonly onToggleChildOption: (parentOptionId: string, childOptionId: string) => void;
  readonly onToggleOption: (optionId: string) => void;
}): ReactElement {
  const visibleOptions = getVisibleQuestionOptions({
    baseAnswers: props.baseAnswers,
    question: props.question,
    selection: props.selection,
  });
  const supportsSingleSelectCascade = hasSingleSelectCascade(props.question);
  const terminalSelectedOptionId =
    props.question.selectionMode === 'single' ? getTerminalSelectedOptionId(props.selection) : null;
  const [requestedActiveOptionId, setRequestedActiveOptionId] = useState<string | null>(
    terminalSelectedOptionId ?? props.selection.selectedOptionIds[0] ?? visibleOptions[0]?.id ?? null,
  );
  const activeOptionId =
    requestedActiveOptionId !== null && visibleOptions.some((option) => option.id === requestedActiveOptionId)
      ? requestedActiveOptionId
      : terminalSelectedOptionId ??
        props.selection.selectedOptionIds.find((optionId) => visibleOptions.some((option) => option.id === optionId)) ??
        visibleOptions[0]?.id ??
        null;
  const activeOption = visibleOptions.find((option) => option.id === activeOptionId) ?? visibleOptions[0] ?? null;
  const activeChildSelections = activeOption === null ? [] : props.selection.childSelections[activeOption.id] ?? [];
  return (
    <section className="mt-8 space-y-5">
      <div>
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">{props.question.prompt}</h2>
        {props.question.description !== null ? (
          <p className="mt-2 text-pretty text-base text-muted-foreground">{props.question.description}</p>
        ) : null}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.25fr)]">
        <div className="space-y-3">
          {visibleOptions.map((option, optionIndex) => {
            const isInSelectedPath = props.selection.selectedOptionIds.includes(option.id);
            const isSelected = terminalSelectedOptionId !== null ? terminalSelectedOptionId === option.id : isInSelectedPath;
            const isActive = activeOption?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  props.onToggleOption(option.id);
                  setRequestedActiveOptionId(option.id);
                }}
                className={cn(
                  'flex w-full items-start gap-4 rounded-2xl border bg-card px-4 py-4 text-left shadow-xs transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isActive || isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                    : isInSelectedPath
                      ? 'border-primary/35 bg-primary/5'
                    : 'border-border hover:border-primary/25 hover:bg-muted/30',
                )}
              >
                <span
                  className={cn(
                    'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isInSelectedPath
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-background text-transparent',
                  )}
                  aria-hidden
                >
                  {isSelected ? <Check className="size-4" /> : isInSelectedPath ? <span className="size-2 rounded-full bg-primary" /> : <Check className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <DiagnosticOptionIcon iconName={option.presentation.icon} optionIndex={optionIndex} />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-foreground">{getDisplayOptionTitle(option)}</p>
                      {getDisplayOptionSupportingText(option) !== null ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{getDisplayOptionSupportingText(option)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
          {activeOption !== null ? (
            <>
              <div className="flex items-start gap-4">
                <DiagnosticOptionIcon
                  iconName={activeOption.presentation.icon}
                  optionIndex={visibleOptions.findIndex((option) => option.id === activeOption.id)}
                />
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    {activeOption.presentation.panelTitle ?? getDisplayOptionTitle(activeOption)}
                  </h3>
                  {activeOption.childQuestion !== null ? (
                    <p className="mt-2 text-sm text-muted-foreground">{activeOption.childQuestion.prompt}</p>
                  ) : null}
                </div>
              </div>
              {activeOption.childQuestion !== null ? (
                <div className="mt-6 space-y-3">
                  {activeOption.childQuestion.options.map((childOption) => {
                    const isSelected = activeChildSelections.includes(childOption.id);
                    return (
                      <button
                        key={childOption.id}
                        type="button"
                        disabled={!props.selection.selectedOptionIds.includes(activeOption.id)}
                        onClick={() => props.onToggleChildOption(activeOption.id, childOption.id)}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                            : 'border-border bg-background hover:border-primary/30',
                          !props.selection.selectedOptionIds.includes(activeOption.id) && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <span>
                          <span className="block text-base font-medium text-foreground">{childOption.label}</span>
                          {childOption.description !== null ? (
                            <span className="mt-1 block text-sm text-muted-foreground">{childOption.description}</span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 flex size-5 items-center justify-center rounded-sm border',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-transparent',
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                  Add a follow-up question to this option in the template editor to show detailed choices here.
                </div>
              )}
              <div className="mt-6 rounded-2xl border border-border/70 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                {props.selection.selectedOptionIds.includes(activeOption.id)
                  ? props.guidance ??
                    (supportsSingleSelectCascade
                      ? 'Choosing a deeper option keeps the earlier steps in your path visible.'
                      : 'Selections in other categories stay saved while you move between panels.')
                  : 'Select this category on the left to enable the detailed choices on the right.'}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SortableRankedSelectionItem(props: {
  readonly index: number;
  readonly onMoveDown: () => void;
  readonly onMoveUp: () => void;
  readonly onRemove: () => void;
  readonly option: DiagnosticQuestionOption;
}): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.option.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`Drag to reorder ${getDisplayOptionTitle(props.option)}`}
      className={cn(
        'cursor-grab rounded-2xl border border-border bg-background p-4 shadow-xs transition-shadow active:cursor-grabbing',
        isDragging && 'border-primary/40 bg-primary/5 shadow-sm',
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          {props.index + 1}
        </span>
        <DiagnosticOptionIcon iconName={props.option.presentation.icon} optionIndex={props.index} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">{getDisplayOptionTitle(props.option)}</p>
          {getDisplayOptionSupportingText(props.option) !== null ? (
            <p className="mt-1 text-sm text-muted-foreground">{getDisplayOptionSupportingText(props.option)}</p>
          ) : null}
        </div>
        <span className="rounded-lg border border-border bg-card p-2 text-muted-foreground">
          <ArrowUpDown className="size-4" aria-hidden />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onMoveUp} disabled={props.index === 0}>
          Move up
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onMoveDown}>
          Move down
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={props.onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function RankedOptionsRoundRenderer(props: {
  readonly baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly onSelectionChange: (nextSelection: DiagnosticQuestionSelection) => void;
  readonly question: DiagnosticQuestionBlock;
  readonly rankedOptionLimit: number;
  readonly selection: DiagnosticQuestionSelection;
}): ReactElement {
  const visibleOptions = getVisibleQuestionOptions({
    baseAnswers: props.baseAnswers,
    question: props.question,
    selection: props.selection,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const selectedOptionIds = props.selection.selectedOptionIds;
  const selectedRankLookup = new Map(selectedOptionIds.map((optionId, optionIndex) => [optionId, optionIndex] as const));
  const selectedOptions = selectedOptionIds
    .map((optionId) => visibleOptions.find((option) => option.id === optionId))
    .filter((option): option is DiagnosticQuestionOption => option !== undefined);

  function updateRankedOptionIds(nextSelectedOptionIds: readonly string[]): void {
    const nextChildSelections = Object.fromEntries(
      Object.entries(props.selection.childSelections).filter(([optionId]) => nextSelectedOptionIds.includes(optionId)),
    );
    props.onSelectionChange({
      selectedOptionIds: [...nextSelectedOptionIds],
      childSelections: nextChildSelections,
    });
  }

  function executeAddOption(optionId: string): void {
    if (selectedOptionIds.includes(optionId) || selectedOptionIds.length >= props.rankedOptionLimit) {
      return;
    }
    updateRankedOptionIds([...selectedOptionIds, optionId]);
  }

  function executeRemoveOption(optionId: string): void {
    updateRankedOptionIds(selectedOptionIds.filter((candidateOptionId) => candidateOptionId !== optionId));
  }

  function executeMoveOption(optionId: string, direction: -1 | 1): void {
    const optionIndex = selectedOptionIds.indexOf(optionId);
    if (optionIndex < 0) {
      return;
    }
    const targetIndex = optionIndex + direction;
    if (targetIndex < 0 || targetIndex >= selectedOptionIds.length) {
      return;
    }
    updateRankedOptionIds(arrayMove([...selectedOptionIds], optionIndex, targetIndex));
  }

  function handleDragEnd(event: DragEndEvent): void {
    if (event.over === null || event.active.id === event.over.id) {
      return;
    }
    const activeIndex = selectedOptionIds.indexOf(String(event.active.id));
    const overIndex = selectedOptionIds.indexOf(String(event.over.id));
    if (activeIndex < 0 || overIndex < 0) {
      return;
    }
    updateRankedOptionIds(arrayMove([...selectedOptionIds], activeIndex, overIndex));
  }

  return (
    <section className="mt-8 space-y-5">
      <div>
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">{props.question.prompt}</h2>
        {props.question.description !== null ? (
          <p className="mt-2 text-pretty text-base text-muted-foreground">{props.question.description}</p>
        ) : null}
        <div className="mt-3 rounded-2xl border border-border bg-muted/25 px-4 py-3 text-sm text-foreground">
          Drag and drop to rank your top <span className="font-semibold">{props.rankedOptionLimit}</span> outcomes.
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,1fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Choose the outcomes you want to rank</p>
          <div className="mt-4 space-y-3">
            {visibleOptions.map((option, optionIndex) => {
              const selectedRankIndex = selectedRankLookup.get(option.id);
              const isSelected = selectedRankIndex !== undefined;
              const isAtLimit = selectedOptionIds.length >= props.rankedOptionLimit;
              const isDisabled = isSelected === false && isAtLimit;
              return (
              <button
                key={option.id}
                type="button"
                onClick={() => (isSelected ? executeRemoveOption(option.id) : executeAddOption(option.id))}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={cn(
                  'relative flex w-full items-start gap-4 rounded-2xl border bg-background px-4 py-4 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isSelected && 'border-primary/50 bg-primary/5 shadow-xs',
                  isDisabled
                    ? 'cursor-not-allowed opacity-60'
                    : isSelected
                      ? 'border-primary/50 hover:border-primary/60 hover:bg-primary/10'
                      : 'border-border hover:border-primary/30 hover:bg-muted/20',
                )}
              >
                <DiagnosticOptionIcon iconName={option.presentation.icon} optionIndex={optionIndex} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-foreground">{optionIndex + 1}. {getDisplayOptionTitle(option)}</p>
                    {option.presentation.badgeText !== null ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        {option.presentation.badgeText}
                      </span>
                    ) : null}
                  </div>
                  {getDisplayOptionSupportingText(option) !== null ? (
                    <p className="mt-1 text-sm text-muted-foreground">{getDisplayOptionSupportingText(option)}</p>
                  ) : null}
                </div>
                {isSelected ? <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> : null}
              </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Your Top Outcomes (rank {props.rankedOptionLimit})</p>
            <p className="text-sm font-medium text-primary">
              {selectedOptionIds.length} / {props.rankedOptionLimit} selected
            </p>
          </div>
          <div className="mt-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={[...selectedOptionIds]} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {selectedOptions.map((option, optionIndex) => (
                    <SortableRankedSelectionItem
                      key={option.id}
                      option={option}
                      index={optionIndex}
                      onMoveUp={() => executeMoveOption(option.id, -1)}
                      onMoveDown={() => executeMoveOption(option.id, 1)}
                      onRemove={() => executeRemoveOption(option.id)}
                    />
                  ))}
                  {Array.from({ length: Math.max(props.rankedOptionLimit - selectedOptions.length, 0) }).map((_, slotIndex) => (
                    <div
                      key={`empty-slot-${slotIndex}`}
                      className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground"
                    >
                      Slot {selectedOptions.length + slotIndex + 1} is empty.
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </section>
  );
}

export type GuidedDiagnosticWizardProps = {
  readonly backLabel: string;
  readonly canGoBack: boolean;
  readonly guided: GuidedDiagnosticV1;
  readonly onGoBack: () => void;
  readonly onGuidedChange: (next: GuidedDiagnosticV1) => void;
};

function resolveVisibleStepIndex(params: {
  readonly activeRound: GuidedDiagnosticV1['activeRound'];
  readonly completedBundles: readonly CompletedRoundBundle[];
}): number {
  const activeRound = params.activeRound;
  if (activeRound === null) {
    return 0;
  }
  const visibleQuestionIndexes = getVisibleQuestionIndexes({
    questions: activeRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: params.completedBundles,
    }),
    answers: activeRound.answers,
  });
  if (visibleQuestionIndexes.length === 0) {
    return 0;
  }
  if (visibleQuestionIndexes.includes(activeRound.stepIndex)) {
    return activeRound.stepIndex;
  }
  const nextVisibleQuestionIndex = visibleQuestionIndexes.find((questionIndex) => questionIndex >= activeRound.stepIndex);
  return nextVisibleQuestionIndex ?? visibleQuestionIndexes[visibleQuestionIndexes.length - 1] ?? 0;
}

function synchronizeActiveRound(params: {
  readonly activeRound: GuidedDiagnosticV1['activeRound'];
  readonly completedBundles: readonly CompletedRoundBundle[];
}): GuidedDiagnosticV1['activeRound'] {
  if (params.activeRound === null) {
    return null;
  }
  const prunedAnswers = pruneHiddenAnswers({
    questions: params.activeRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: params.completedBundles,
    }),
    answers: params.activeRound.answers,
    answerNotes: params.activeRound.answerNotes,
  });
  const stepIndex = resolveVisibleStepIndex({
    activeRound: {
      ...params.activeRound,
      answers: prunedAnswers.answers,
      answerNotes: prunedAnswers.answerNotes,
    },
    completedBundles: params.completedBundles,
  });
  return {
    ...params.activeRound,
    answers: prunedAnswers.answers,
    answerNotes: prunedAnswers.answerNotes,
    stepIndex,
  };
}

function buildVisibleBundleFromActive(params: {
  readonly activeRound: GuidedDiagnosticV1['activeRound'];
  readonly completedBundles: readonly CompletedRoundBundle[];
}): CompletedRoundBundle | null {
  const synchronizedRound = synchronizeActiveRound(params);
  if (synchronizedRound === null) {
    return null;
  }
  const visibleQuestionIndexes = getVisibleQuestionIndexes({
    questions: synchronizedRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: params.completedBundles,
    }),
    answers: synchronizedRound.answers,
  });
  const visibleQuestions = visibleQuestionIndexes.flatMap((questionIndex) => {
    const question = synchronizedRound.questions[questionIndex];
    return question === undefined ? [] : [question];
  });
  if (visibleQuestions.length === 0) {
    return null;
  }
  return {
    roundIndex: synchronizedRound.roundIndex,
    roundTitle: synchronizedRound.roundTitle,
    questions: visibleQuestions,
    answers: { ...synchronizedRound.answers },
    answerNotes: { ...synchronizedRound.answerNotes },
    guidance: synchronizedRound.guidance,
  };
}

type DiagnosticPublicConfig = {
  readonly diagnosticAiEnabled: boolean;
  readonly diagnosticCacheDebugEnabled: boolean;
};

type DiagnosticTemplateApiBody = {
  readonly template: PublicDiagnosticTemplateValue | null;
  readonly error?: string;
  readonly details?: string;
};

type DiagnosticTemplateSummaryApiBody = {
  readonly summaryForAdvisor?: string;
  readonly mappedSituation?: string;
  readonly error?: string;
  readonly details?: string;
};

export function GuidedDiagnosticWizard(props: GuidedDiagnosticWizardProps): ReactElement {
  const { backLabel, canGoBack, guided, onGoBack, onGuidedChange } = props;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAwaitingApi, setIsAwaitingApi] = useState<boolean>(false);
  const [diagnosticDebugLog, setDiagnosticDebugLog] = useState<DiagnosticDebugLogEntry[]>([]);
  const [cacheDebugUiEnabled, setCacheDebugUiEnabled] = useState<boolean>(false);
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(false);
  const [activeTemplate, setActiveTemplate] = useState<PublicDiagnosticTemplateValue | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const initialTemplateRound = useMemo(() => {
    if (activeTemplate === null) {
      return null;
    }
    return buildNextTemplateRoundFromState({
      template: activeTemplate,
      completedBundles: [],
      startRoundIndex: 0,
    });
  }, [activeTemplate]);
  useEffect(() => {
    let cancelled = false;
    async function loadDiagnosticMode(): Promise<void> {
      try {
        const configResponse = await fetch(DIAGNOSTIC_CONFIG_API_URL);
        const configData = (await configResponse.json()) as DiagnosticPublicConfig;
        if (cancelled) {
          return;
        }
        setDiagnosticAiEnabled(typeof configData.diagnosticAiEnabled === 'boolean' ? configData.diagnosticAiEnabled : false);
        if (typeof configData.diagnosticCacheDebugEnabled === 'boolean') {
          setCacheDebugUiEnabled(configData.diagnosticCacheDebugEnabled);
        }
        if (configData.diagnosticAiEnabled) {
          setActiveTemplate(null);
          return;
        }
        const templateResponse = await fetch(DIAGNOSTIC_TEMPLATE_API_URL);
        const templateData = (await templateResponse.json()) as DiagnosticTemplateApiBody;
        if (cancelled) {
          return;
        }
        setActiveTemplate(templateData.template);
      } catch {
        if (!cancelled) {
          setActiveTemplate(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    }
    void loadDiagnosticMode();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (diagnosticAiEnabled || isLoadingConfig || initialTemplateRound === null) {
      return;
    }
    if (guided.activeRound !== null || guided.completedBundles.length > 0 || guided.outcome !== null) {
      return;
    }
    onGuidedChange({
      ...guided,
      initialPrompt: '',
      completedBundles: [],
      activeRound: initialTemplateRound,
      outcome: null,
    });
  }, [diagnosticAiEnabled, guided, initialTemplateRound, isLoadingConfig, onGuidedChange]);
  const executeUpdatePrompt = useCallback(
    (value: string): void => {
      onGuidedChange({
        ...guided,
        initialPrompt: value,
      });
    },
    [guided, onGuidedChange],
  );
  const executeToggleSeedChip = useCallback(
    (phrase: string): void => {
      setErrorMessage(null);
      const next = togglePromptWithSeed(guided.initialPrompt, phrase);
      onGuidedChange({
        ...guided,
        initialPrompt: next,
      });
    },
    [guided, onGuidedChange],
  );
  const executeSelectOption = useCallback(
    (question: DiagnosticQuestionBlock, optionId: string): void => {
      if (guided.activeRound === null) {
        return;
      }
      const nextSelection = toggleQuestionOptionSelection({
        question,
        selection: guided.activeRound.answers[question.id],
        optionId,
      });
      const nextActiveRound = synchronizeActiveRound({
        completedBundles: guided.completedBundles,
        activeRound: {
          ...guided.activeRound,
          answers: {
            ...guided.activeRound.answers,
            [question.id]: nextSelection,
          },
        },
      });
      onGuidedChange({
        ...guided,
        activeRound: nextActiveRound,
      });
    },
    [guided, onGuidedChange],
  );
  const executeSelectChildOption = useCallback(
    (question: DiagnosticQuestionBlock, parentOptionId: string, childOptionId: string): void => {
      if (guided.activeRound === null) {
        return;
      }
      const nextSelection = toggleChildQuestionOptionSelection({
        question,
        selection: guided.activeRound.answers[question.id],
        parentOptionId,
        childOptionId,
      });
      const nextActiveRound = synchronizeActiveRound({
        completedBundles: guided.completedBundles,
        activeRound: {
          ...guided.activeRound,
          answers: {
            ...guided.activeRound.answers,
            [question.id]: nextSelection,
          },
        },
      });
      onGuidedChange({
        ...guided,
        activeRound: nextActiveRound,
      });
    },
    [guided, onGuidedChange],
  );
  const executeSetQuestionSelection = useCallback(
    (questionId: string, nextSelection: DiagnosticQuestionSelection): void => {
      if (guided.activeRound === null) {
        return;
      }
      const nextActiveRound = synchronizeActiveRound({
        completedBundles: guided.completedBundles,
        activeRound: {
          ...guided.activeRound,
          answers: {
            ...guided.activeRound.answers,
            [questionId]: nextSelection,
          },
        },
      });
      onGuidedChange({
        ...guided,
        activeRound: nextActiveRound,
      });
    },
    [guided, onGuidedChange],
  );
  const executeUpdateAnswerNote = useCallback(
    (questionId: string, value: string): void => {
      if (guided.activeRound === null) {
        return;
      }
      const capped =
        value.length > MAX_ANSWER_NOTE_LENGTH ? value.slice(0, MAX_ANSWER_NOTE_LENGTH) : value;
      onGuidedChange({
        ...guided,
        activeRound: {
          ...guided.activeRound,
          answerNotes: {
            ...guided.activeRound.answerNotes,
            [questionId]: capped,
          },
        },
      });
    },
    [guided, onGuidedChange],
  );
  const executeFetchRound = useCallback(
    async (completedBundles: CompletedRoundBundle[]): Promise<void> => {
      const trimmed = guided.initialPrompt.trim();
      const response = await fetch(DIAGNOSTIC_ROUND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialPrompt: trimmed,
          rounds: toApiRoundsFromBundles(completedBundles),
        }),
      });
      const data = (await response.json()) as DiagnosticRoundApiBody;
      if (!response.ok) {
        if (response.status === 503 && data.code === 'missing_key') {
          setErrorMessage('Add OPENAI_API_KEY to enable guided intake.');
        } else {
          const hint = typeof data.details === 'string' ? ` ${data.details}` : '';
          setErrorMessage(`${data.error ?? 'Something went wrong. Try again.'}${hint}`);
        }
        return;
      }
      const debugMeta = extractDiagnosticRoundDebugFromResponse(response, data);
      if (debugMeta !== null && cacheDebugUiEnabled) {
        const label =
          data.complete === true
            ? 'Completion & mapping'
            : `Round ${completedBundles.length + 1} — question block`;
        setDiagnosticDebugLog((previous) => [
          ...previous,
          { id: crypto.randomUUID(), label, meta: debugMeta },
        ]);
      }
      if (data.complete === true) {
        const mappedSituation = data.mappedSituation ?? 'Not sure yet — need clarity first';
        const advisorSummary =
          typeof data.summaryForAdvisor === 'string' && data.summaryForAdvisor.trim().length > 0
            ? data.summaryForAdvisor.trim()
            : '';
        const outcome: GuidedDiagnosticOutcome = {
          mappedSituation,
          advisorSummary,
        };
        onGuidedChange({
          ...guided,
          completedBundles,
          activeRound: null,
          outcome,
        });
        return;
      }
      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (questions.length === 0) {
        setErrorMessage('No questions returned — try again.');
        return;
      }
      const mappedQuestions: DiagnosticQuestionBlock[] = questions.map((row) => ({
        id: row.id,
        prompt: row.prompt,
        description: null,
        showWhen: null,
        type: 'multiple-choice',
        rankedOptionLimit: null,
        selectionMode: 'single',
        options: normalizeDiagnosticOptions(row.options),
      }));
      onGuidedChange({
        ...guided,
        completedBundles,
        activeRound: {
          roundIndex: completedBundles.length,
          roundTitle: `Round ${completedBundles.length + 1}`,
          questions: mappedQuestions,
          answers: {},
          answerNotes: {},
          stepIndex: 0,
          guidance: typeof data.guidance === 'string' ? data.guidance : null,
        },
      });
    },
    [cacheDebugUiEnabled, guided, onGuidedChange],
  );
  const executeFetchTemplateSummary = useCallback(
    async (completedBundles: CompletedRoundBundle[]): Promise<GuidedDiagnosticOutcome> => {
      if (activeTemplate === null) {
        return buildTemplateDiagnosticOutcome(
          guided.initialPrompt,
          completedBundles,
          {
            id: 'missing-template',
            name: 'Diagnostic template',
            rounds: [],
          },
          '',
        );
      }
      const response = await fetch(DIAGNOSTIC_TEMPLATE_SUMMARY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: activeTemplate.name,
          initialPrompt: guided.initialPrompt,
          rounds: toApiRoundsFromBundles(completedBundles),
        }),
      });
      const data = (await response.json()) as DiagnosticTemplateSummaryApiBody;
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? 'Failed to generate advisor summary.');
      }
      return buildTemplateDiagnosticOutcome(
        guided.initialPrompt,
        completedBundles,
        activeTemplate,
        data.summaryForAdvisor ?? '',
      );
    },
    [activeTemplate, guided.initialPrompt],
  );
  const executeStartFromPrompt = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    const trimmed = guided.initialPrompt.trim();
    if (trimmed.length < MIN_PROMPT_LENGTH) {
      setErrorMessage(`Add a bit more detail (at least ~${MIN_PROMPT_LENGTH} characters) so we can tailor questions.`);
      return;
    }
    setIsAwaitingApi(true);
    try {
      await executeFetchRound([]);
    } finally {
      setIsAwaitingApi(false);
    }
  }, [executeFetchRound, guided.initialPrompt]);
  const executeAdvanceOrSubmitRound = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    if (guided.activeRound === null) {
      return;
    }
    const activeRound = synchronizeActiveRound({
      activeRound: guided.activeRound,
      completedBundles: guided.completedBundles,
    });
    if (activeRound === null) {
      return;
    }
    const currentQuestion = activeRound.questions[activeRound.stepIndex];
    if (currentQuestion === undefined) {
      return;
    }
    const selection = activeRound.answers[currentQuestion.id];
    const detailNote = activeRound.answerNotes[currentQuestion.id] ?? '';
    const validation = validateGuidedQuestionResponse({
      baseAnswers: buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
        activeRound,
      }),
      question: currentQuestion,
      selection,
      detailNote,
    });
    if (!validation.isValid) {
      setErrorMessage(validation.message ?? 'Pick an option above or type your exact answer below.');
      return;
    }
    const nextQuestionIndex = findNextVisibleQuestionIndex({
      questions: activeRound.questions,
      baseAnswers: buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
      }),
      answers: activeRound.answers,
      currentIndex: activeRound.stepIndex,
    });
    if (nextQuestionIndex !== null) {
      onGuidedChange({
        ...guided,
        activeRound: {
          ...activeRound,
          stepIndex: nextQuestionIndex,
        },
      });
      return;
    }
    const bundle = buildVisibleBundleFromActive({
      activeRound,
      completedBundles: guided.completedBundles,
    });
    if (bundle === null) {
      return;
    }
    const nextCompleted = [...guided.completedBundles, bundle];
    if (!diagnosticAiEnabled) {
      if (activeTemplate === null) {
        setErrorMessage('AI Diagnostic is off, but no active template is ready yet.');
        return;
      }
      const nextRound = buildNextTemplateRoundFromState({
        template: activeTemplate,
        completedBundles: nextCompleted,
        startRoundIndex: activeRound.roundIndex + 1,
      });
      if (nextRound !== null) {
        onGuidedChange({
          ...guided,
          completedBundles: nextCompleted,
          activeRound: nextRound,
          outcome: null,
        });
        return;
      }
      setIsAwaitingApi(true);
      try {
        const outcome = await executeFetchTemplateSummary(nextCompleted);
        onGuidedChange({
          ...guided,
          completedBundles: nextCompleted,
          activeRound: null,
          outcome,
        });
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to generate advisor summary.');
      } finally {
        setIsAwaitingApi(false);
      }
      return;
    }
    setIsAwaitingApi(true);
    try {
      await executeFetchRound(nextCompleted);
    } finally {
      setIsAwaitingApi(false);
    }
  }, [activeTemplate, diagnosticAiEnabled, executeFetchRound, executeFetchTemplateSummary, guided, onGuidedChange]);
  if (guided.outcome !== null) {
    const { mappedSituation, advisorSummary } = guided.outcome;
    const transcript = buildDiagnosticTranscript(guided);
    return (
      <div>
        <DiagnosticCacheDebugPanel
          showDebugUi={cacheDebugUiEnabled}
          entries={diagnosticDebugLog}
          onClear={() => setDiagnosticDebugLog([])}
        />
        <p className="mt-2 text-pretty text-muted-foreground">
          Review everything you shared, how we mapped it, and the advisor summary. Use{' '}
          <span className="font-medium text-foreground">Continue</span> below to see your recommendation.
        </p>
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Intake complete</p>
          <h2 className="mt-4 text-base font-semibold text-foreground">What you shared</h2>
          {transcript.initialPrompt.trim().length > 0 ? (
            <>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Your situation (in your words)</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{transcript.initialPrompt}</p>
            </>
          ) : null}
          {transcript.rounds.map((round) => {
            const label = `Round ${round.roundIndex + 1}`;
            return (
              <div key={round.roundIndex} className="mt-8 border-t border-border pt-8">
                <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                {round.guidance !== null && round.guidance.length > 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{round.guidance}</p>
                ) : null}
                <ul className="mt-4 space-y-5" role="list">
                  {round.items.map((item, itemIndex) => {
                    const ordinal = itemIndex + 1;
                    return (
                      <li key={`${round.roundIndex}-${ordinal}`}>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Question {ordinal}
                        </p>
                        <p className="mt-1 text-sm leading-snug text-foreground">{item.question}</p>
                        {item.description !== null ? (
                          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                        ) : null}
                        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Your answer</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.answer.length > 0 ? item.answer : '—'}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <div className="mt-8 border-t border-border pt-8">
            <p className="text-sm font-medium text-muted-foreground">Mapped situation</p>
            <p className="mt-1 text-base font-semibold text-foreground">{mappedSituation}</p>
          </div>
          <div className="mt-8 border-t border-border pt-8">
            <p className="text-sm font-medium text-muted-foreground">Summary for your advisor</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{advisorSummary}</p>
          </div>
        </div>
      </div>
    );
  }
  if (guided.activeRound !== null) {
    const activeRound = synchronizeActiveRound({
      activeRound: guided.activeRound,
      completedBundles: guided.completedBundles,
    });
    if (activeRound === null) {
      return <div />;
    }
    const baseAnswers = buildDiagnosticAnswerLookup({
      completedBundles: guided.completedBundles,
    });
    const optionBaseAnswers = buildDiagnosticAnswerLookup({
      completedBundles: guided.completedBundles,
      activeRound,
    });
    const visibleQuestionIndexes = getVisibleQuestionIndexes({
      questions: activeRound.questions,
      baseAnswers,
      answers: activeRound.answers,
    });
    const question = activeRound.questions[activeRound.stepIndex];
    const questionSelection =
      question !== undefined
        ? (activeRound.answers[question.id] ?? createEmptyDiagnosticQuestionSelection())
        : createEmptyDiagnosticQuestionSelection();
    const showGuidance =
      visibleQuestionIndexes.indexOf(activeRound.stepIndex) === 0 &&
      activeRound.guidance !== null &&
      activeRound.guidance.length > 0;
    const positionInRound = Math.max(visibleQuestionIndexes.indexOf(activeRound.stepIndex) + 1, 1);
    const roundSize = visibleQuestionIndexes.length;
    const noteCharactersRemaining = question !== undefined
      ? MAX_ANSWER_NOTE_LENGTH - (activeRound.answerNotes[question.id]?.length ?? 0)
      : MAX_ANSWER_NOTE_LENGTH;
    const nextVisibleQuestionIndex = findNextVisibleQuestionIndex({
      questions: activeRound.questions,
      baseAnswers,
      answers: activeRound.answers,
      currentIndex: activeRound.stepIndex,
    });
    const nextTemplateRound =
      !diagnosticAiEnabled && activeTemplate !== null
        ? buildNextTemplateRoundFromState({
            template: activeTemplate,
            completedBundles: [
              ...guided.completedBundles,
              buildVisibleBundleFromActive({
                activeRound,
                completedBundles: guided.completedBundles,
              }),
            ].filter((bundle): bundle is CompletedRoundBundle => bundle !== null),
            startRoundIndex: activeRound.roundIndex + 1,
          })
        : null;
    const nextTemplateRoundTitle = nextTemplateRound?.roundTitle ?? null;
    const hasMoreQuestionsInRound: boolean = nextVisibleQuestionIndex !== null;
    const trimmedNextTemplateRoundTitle: string | null =
      nextTemplateRoundTitle !== null && nextTemplateRoundTitle.trim().length > 0 ? nextTemplateRoundTitle.trim() : null;
    const advanceLabel =
      hasMoreQuestionsInRound
        ? 'Next'
        : !diagnosticAiEnabled
          ? trimmedNextTemplateRoundTitle !== null
            ? `Continue to ${trimmedNextTemplateRoundTitle}`
            : 'Continue: Summary'
          : 'Submit round';
    return (
      <div>
        <DiagnosticCacheDebugPanel
          showDebugUi={cacheDebugUiEnabled}
          entries={diagnosticDebugLog}
          onClear={() => setDiagnosticDebugLog([])}
        />
        <p className="mt-2 text-pretty text-muted-foreground">
          {question?.type === 'ranked-options'
            ? 'Rank the outcomes that matter most. Your progress is saved, so refresh or use Back and you will return to the same step.'
            : question?.type === 'nested-options'
              ? 'Choose one or more categories, then answer the detailed options in the right-hand panel. Your progress is saved automatically.'
              : 'Answer one question at a time. Your progress is saved, so refresh or use Back and you will return to the same step.'}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Question {positionInRound} of {roundSize} · {activeRound.roundTitle}
        </p>
        {showGuidance ? (
          <p className="mt-4 text-sm font-medium text-foreground">{activeRound.guidance}</p>
        ) : null}
        {question !== undefined ? (
          <>
            {question.type === 'nested-options' ? (
              <NestedOptionsRoundRenderer
                baseAnswers={optionBaseAnswers}
                guidance={activeRound.guidance}
                question={question}
                selection={questionSelection}
                onToggleOption={(optionId) => executeSelectOption(question, optionId)}
                onToggleChildOption={(parentOptionId, childOptionId) =>
                  executeSelectChildOption(question, parentOptionId, childOptionId)
                }
              />
            ) : question.type === 'ranked-options' ? (
              <RankedOptionsRoundRenderer
                baseAnswers={optionBaseAnswers}
                question={question}
                rankedOptionLimit={question.rankedOptionLimit ?? 3}
                selection={questionSelection}
                onSelectionChange={(nextSelection) => executeSetQuestionSelection(question.id, nextSelection)}
              />
            ) : (
              <MultipleChoiceRoundRenderer
                baseAnswers={optionBaseAnswers}
                question={question}
                selection={questionSelection}
                onToggleOption={(optionId) => executeSelectOption(question, optionId)}
                onToggleChildOption={(parentOptionId, childOptionId) =>
                  executeSelectChildOption(question, parentOptionId, childOptionId)
                }
              />
            )}
            <div className="mt-6">
              <label
                htmlFor={`diagnostic-exact-answer-${question.id}`}
                className="text-sm font-medium text-foreground"
              >
                Your exact answer
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick an option, answer any visible follow-up group, type here, or combine both. Use this for specifics
                the buttons do not cover (versions, errors, timing).
              </p>
              <Textarea
                id={`diagnostic-exact-answer-${question.id}`}
                value={activeRound.answerNotes[question.id] ?? ''}
                onChange={(event) => executeUpdateAnswerNote(question.id, event.target.value)}
                disabled={isAwaitingApi}
                rows={3}
                maxLength={MAX_ANSWER_NOTE_LENGTH}
                placeholder="Type the precise answer or extra detail for your advisor…"
                className="mt-2 rounded-xl border-border bg-card shadow-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {noteCharactersRemaining} characters left
              </p>
            </div>
          </>
        ) : null}
        {errorMessage !== null ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {isAwaitingApi ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            {diagnosticAiEnabled ? 'Updating your diagnostic…' : 'Preparing your advisor summary…'}
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              {canGoBack ? (
                <Button type="button" variant="outline" onClick={onGoBack}>
                  {backLabel}
                </Button>
              ) : null}
            </div>
            <Button type="button" onClick={() => void executeAdvanceOrSubmitRound()}>
              {advanceLabel}
            </Button>
          </div>
        )}
      </div>
    );
  }
  if (!diagnosticAiEnabled) {
    if (isLoadingConfig || initialTemplateRound !== null) {
      return (
        <div>
          <p className="mt-2 text-pretty text-muted-foreground">
            Preparing your diagnostic template and saving your progress automatically.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            Opening the active template…
          </div>
        </div>
      );
    }
    return (
      <div>
        <p className="mt-2 text-pretty text-muted-foreground">
          Template mode is active, but there is no usable active template yet.
        </p>
        <div className="mt-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Ask an admin to create and activate a diagnostic template before customers start this flow.
        </div>
      </div>
    );
  }
  return (
    <div>
      <DiagnosticCacheDebugPanel
        showDebugUi={cacheDebugUiEnabled}
        entries={diagnosticDebugLog}
        onClear={() => setDiagnosticDebugLog([])}
      />
      <p className="mt-2 text-pretty text-muted-foreground">
        {diagnosticAiEnabled
          ? 'Describe the problem in your own words. We will ask short guided questions until we have enough context to map your case.'
          : 'Describe the problem in your own words. We will guide you through the active diagnostic template your advisor configured for customer-facing intake.'}
      </p>
      {!diagnosticAiEnabled ? (
        <div className="mt-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {activeTemplate !== null ? (
            <span>
              Template mode is active: <span className="font-medium text-foreground">{activeTemplate.name}</span>.
            </span>
          ) : (
            'Template mode is active, but no usable diagnostic template is available yet.'
          )}
        </div>
      ) : null}
      <label htmlFor="diagnostic-prompt" className="mt-6 block text-sm font-medium text-foreground">
        Your situation
      </label>
      <textarea
        id="diagnostic-prompt"
        value={guided.initialPrompt}
        disabled={isAwaitingApi}
        onChange={(event) => executeUpdatePrompt(event.target.value)}
        rows={4}
        placeholder='Example: "Our MongoDB cluster is slow during payroll runs."'
        className={cn(
          'mt-2 w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-xs outline-none transition-colors',
          'placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
          isAwaitingApi ? 'opacity-80' : '',
        )}
      />
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Or tap a starting point
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Common situations">
          {SITUATION_SEED_CHIPS.map((phrase) => {
            const isActive = isSeedActiveInPrompt(guided.initialPrompt, phrase);
            return (
              <button
                key={phrase}
                type="button"
                onClick={() => executeToggleSeedChip(phrase)}
                disabled={isAwaitingApi}
                aria-pressed={isActive}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isActive
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50',
                  isAwaitingApi ? 'opacity-60' : '',
                )}
              >
                {phrase}
              </button>
            );
          })}
        </div>
      </div>
      {errorMessage !== null ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isAwaitingApi ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          {diagnosticAiEnabled ? 'Preparing your first questions…' : 'Preparing your first template round…'}
        </div>
      ) : (
        <div className="mt-6">
          <Button
            type="button"
            onClick={() => void executeStartFromPrompt()}
            disabled={
              guided.initialPrompt.trim().length < MIN_PROMPT_LENGTH ||
              isLoadingConfig ||
              (!diagnosticAiEnabled && activeTemplate === null)
            }
          >
            {diagnosticAiEnabled ? 'Start guided questions' : 'Start diagnostic template'}
          </Button>
        </div>
      )}
    </div>
  );
}
