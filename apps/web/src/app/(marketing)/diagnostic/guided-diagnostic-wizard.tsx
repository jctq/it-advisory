'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Check,
  CheckCircle2,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { DiagnosticOutcomePanel } from '@/components/marketing/diagnostic-outcome-panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { inferRecommendedServiceKeyFromContext } from '@/lib/marketing/resolve-recommended-service-key';
import type { PublicDiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import {
  buildNextTemplateRoundFromState,
  buildTemplateDiagnosticOutcome,
} from '@/lib/marketing/diagnostic-template-flow';
import type { DiagnosticRoundDebugMeta } from '@/domain/types';
import { extractDiagnosticRoundDebugFromResponse } from '@/lib/marketing/diagnostic-cache-debug';
import {
  applyGuidedPeekCompletedBundleIndex,
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
  normalizeDiagnosticOptions,
  pruneHiddenAnswers,
  toggleChildQuestionOptionSelection,
  toggleQuestionOptionSelection,
  toApiRoundsFromBundles,
  validateGuidedQuestionResponse,
  shouldShowQuestionDetailNoteInput,
} from '@/lib/marketing/guided-diagnostic-types';
import { getSituationSeed } from '@/lib/marketing/situation-options';
import { notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  resolveProjectRescueBriefAssessment,
  resolveProjectRescueGoodFitBullets,
  resolveProjectRescueSessionTitle,
} from '@techmd/diagnostic-core/project-rescue-service-context';

const MIN_PROMPT_LENGTH = 8;
const MAX_ANSWER_NOTE_LENGTH = 2000;
const SITUATION_SEED_CHIPS: readonly string[] = getSituationSeed();
const DIAGNOSTIC_CONFIG_API_URL = '/api/quiz/diagnostic-config';
const DIAGNOSTIC_ROUND_API_URL = '/api/quiz/diagnostic-round';
const DIAGNOSTIC_TEMPLATE_API_URL = '/api/quiz/diagnostic-template';
const DIAGNOSTIC_TEMPLATE_SUMMARY_API_URL = '/api/quiz/diagnostic-template-summary';

function scheduleScrollQuizWizardToTop(): void {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function isGuidedStateEmptyForTemplateBootstrap(guided: GuidedDiagnosticV1): boolean {
  return guided.activeRound === null && guided.completedBundles.length === 0 && guided.outcome === null;
}

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
  readonly briefAssessment?: string;
  readonly sessionTitle?: string;
  readonly goodFitBullets?: readonly string[];
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
          database (exact hash match or semantic vector neighbor);{' '}
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
                    {entry.meta.source === 'cache' ? 'Database cache' : 'AI (OpenAI)'}
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

/** Mobile-first spacing and type — desktop keeps the roomier marketing layout. */
const WIZARD_UI = {
  sectionMt: 'mt-4 md:mt-8',
  sectionStack: 'space-y-3 md:space-y-5',
  questionTitle: 'text-balance text-xl font-semibold tracking-tight text-foreground md:text-2xl',
  questionDesc: 'text-pretty text-sm leading-relaxed text-muted-foreground md:text-base',
  hintText: 'text-xs font-medium text-muted-foreground md:text-sm',
  optionCard:
    'rounded-xl border bg-card p-3.5 text-left shadow-xs transition-all md:rounded-2xl md:p-5',
  optionTitle: 'text-base font-semibold text-foreground md:text-lg',
  optionSupporting: 'text-sm leading-5 text-muted-foreground md:leading-6',
  panelShell: 'rounded-2xl border border-border bg-card p-4 shadow-xs md:rounded-3xl md:p-6',
  gridGap: 'gap-2.5 md:gap-4',
  gridGapLg: 'gap-3 md:gap-5',
  footerMt: 'mt-6 md:mt-8',
  selectIndicator: 'flex size-5 shrink-0 items-center justify-center rounded-md border md:size-6',
} as const;

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

function resolveNestedGuidanceMessage(params: {
  readonly guidanceOverride: string | null;
  readonly hasParentSelected: boolean;
  readonly question: DiagnosticQuestionBlock;
  readonly supportsSingleSelectCascade: boolean;
}): string | null {
  if (!params.hasParentSelected) {
    return 'Select this category to enable the detailed choices on the right.';
  }
  if (params.guidanceOverride !== null) {
    return params.guidanceOverride;
  }
  if (params.supportsSingleSelectCascade) {
    return 'Choosing a deeper option keeps the earlier steps in your path visible.';
  }
  if (params.question.selectionMode === 'multiple') {
    return 'Selections in other categories stay saved while you move between panels.';
  }
  return null;
}

function getTerminalSelectedOptionId(selection: DiagnosticQuestionSelection): string | null {
  return selection.selectedOptionIds[selection.selectedOptionIds.length - 1] ?? null;
}

function resolveNestedPanelOptionIdFromSelection(params: {
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
  readonly visibleOptions: readonly DiagnosticQuestionOption[];
}): string | null {
  const { question, selection, visibleOptions } = params;
  if (visibleOptions.length === 0) {
    return null;
  }
  const selectedInOrder = visibleOptions.filter((option) => selection.selectedOptionIds.includes(option.id));
  for (let index = selectedInOrder.length - 1; index >= 0; index -= 1) {
    const candidate = selectedInOrder[index];
    if (candidate !== undefined && candidate.childQuestion !== null) {
      return candidate.id;
    }
  }
  if (question.selectionMode === 'single') {
    const terminalId = getTerminalSelectedOptionId(selection);
    if (terminalId !== null && visibleOptions.some((option) => option.id === terminalId)) {
      return terminalId;
    }
  }
  const firstVisibleSelected = selection.selectedOptionIds.find((id) => visibleOptions.some((option) => option.id === id));
  return firstVisibleSelected ?? null;
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
    <span
      className={cn(
        'hidden shrink-0 items-center justify-center rounded-full md:flex',
        'size-9 lg:size-12',
        getAccentClassName(props.optionIndex),
      )}
      aria-hidden
    >
      <IconComponent className="size-4 lg:size-6" />
    </span>
  );
}

function MultipleChoiceRoundRenderer(props: {
  readonly baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
  readonly sessionReadOnly?: boolean;
  readonly onToggleChildOption: (parentOptionId: string, childOptionId: string) => void;
  readonly onToggleOption: (optionId: string) => void;
}): ReactElement {
  const sessionReadOnly = props.sessionReadOnly === true;
  const visibleOptions = getVisibleQuestionOptions({
    baseAnswers: props.baseAnswers,
    question: props.question,
    selection: props.selection,
  });
  const supportsSingleSelectCascade = hasSingleSelectCascade(props.question);
  const terminalSelectedOptionId =
    props.question.selectionMode === 'single' ? getTerminalSelectedOptionId(props.selection) : null;
  return (
    <fieldset className={cn(WIZARD_UI.sectionMt, WIZARD_UI.sectionStack)}>
      <legend className={WIZARD_UI.questionTitle}>{props.question.prompt}</legend>
      {props.question.description !== null ? (
        <p className={WIZARD_UI.questionDesc}>{props.question.description}</p>
      ) : null}
      <p className={WIZARD_UI.hintText}>
        {props.question.selectionMode === 'multiple'
          ? 'Select one or more options.'
          : supportsSingleSelectCascade
            ? 'Choose one path. More choices may appear after your first selection.'
            : 'Select the option that fits best.'}
      </p>
      <div className={cn('grid xl:grid-cols-3 md:grid-cols-2', WIZARD_UI.gridGap)} role="group">
        {visibleOptions.map((option, optionIndex) => {
          const isInSelectedPath = props.selection.selectedOptionIds.includes(option.id);
          const isSelected = terminalSelectedOptionId !== null ? terminalSelectedOptionId === option.id : isInSelectedPath;
          const supportingText = getDisplayOptionSupportingText(option);
          const selectedChildOptionIds = props.selection.childSelections[option.id] ?? [];
          return (
            <div key={`${props.question.id}-${option.id}`} className="space-y-2 md:space-y-3">
              <button
                type="button"
                disabled={sessionReadOnly}
                onClick={() => props.onToggleOption(option.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex h-full w-full flex-col text-left transition-all',
                  WIZARD_UI.optionCard,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : isInSelectedPath
                      ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30',
                  sessionReadOnly && 'cursor-default opacity-95',
                )}
              >
                <div className="flex items-start gap-3 md:gap-4">
                  <DiagnosticOptionIcon iconName={option.presentation.icon} optionIndex={optionIndex} />
                  <div className="min-w-0 flex-1 space-y-1.5 md:space-y-2">
                    {option.presentation.eyebrow !== null ? (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary md:text-xs">
                        {option.presentation.eyebrow}
                      </p>
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:gap-2">
                        <h3 className={WIZARD_UI.optionTitle}>{getDisplayOptionTitle(option)}</h3>
                        {option.presentation.badgeText !== null ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 md:px-2 md:py-1 md:text-[11px]">
                            {option.presentation.badgeText}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          WIZARD_UI.selectIndicator,
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isInSelectedPath
                              ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-border bg-background text-transparent',
                        )}
                        aria-hidden
                      >
                        {isSelected ? (
                          <Check className="size-3.5 md:size-4" />
                        ) : isInSelectedPath ? (
                          <span className="size-1.5 rounded-full bg-primary md:size-2" />
                        ) : (
                          <Check className="size-3.5 md:size-4" />
                        )}
                      </span>
                    </div>
                    {supportingText !== null ? (
                      <p className={WIZARD_UI.optionSupporting}>{supportingText}</p>
                    ) : null}
                  </div>
                </div>
                {option.presentation.exampleBullets.length > 0 ? (
                  <div className="mt-3 border-t border-border/70 pt-3 md:mt-5 md:pt-4">
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
                <fieldset className="rounded-xl border border-border/70 bg-muted/25 p-3 md:rounded-2xl md:p-4">
                  <legend className="px-1 text-xs font-semibold text-foreground md:text-sm">{option.childQuestion.prompt}</legend>
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
                          disabled={sessionReadOnly}
                          onClick={() => props.onToggleChildOption(option.id, childOption.id)}
                          className={cn(
                            'flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors md:gap-3 md:rounded-xl md:px-4 md:py-3',
                            isChildSelected
                              ? 'border-primary bg-background ring-2 ring-primary/15'
                              : 'border-border bg-background/80 hover:border-primary/30',
                            sessionReadOnly && 'cursor-default opacity-95',
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

function canFocusNestedPanelOption(params: {
  readonly optionId: string;
  readonly selection: DiagnosticQuestionSelection;
  readonly sessionReadOnly: boolean;
}): boolean {
  if (!params.sessionReadOnly) {
    return true;
  }
  return params.selection.selectedOptionIds.includes(params.optionId);
}

function NestedOptionsRoundRenderer(props: {
  readonly baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly guidance: string | null;
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
  readonly sessionReadOnly?: boolean;
  readonly onToggleChildOption: (parentOptionId: string, childOptionId: string) => void;
  readonly onToggleOption: (optionId: string) => void;
}): ReactElement {
  const sessionReadOnly = props.sessionReadOnly === true;
  const visibleOptions = useMemo(
    () =>
      getVisibleQuestionOptions({
        baseAnswers: props.baseAnswers,
        question: props.question,
        selection: props.selection,
      }),
    [props.baseAnswers, props.question, props.selection],
  );
  const supportsSingleSelectCascade = hasSingleSelectCascade(props.question);
  const terminalSelectedOptionId =
    props.question.selectionMode === 'single' ? getTerminalSelectedOptionId(props.selection) : null;
  const [requestedActiveOptionId, setRequestedActiveOptionId] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      setRequestedActiveOptionId(null);
    });
  }, [props.question.id]);
  const selectionDefaultPanelId = useMemo(
    () =>
      resolveNestedPanelOptionIdFromSelection({
        question: props.question,
        selection: props.selection,
        visibleOptions,
      }),
    [props.question, props.selection, visibleOptions],
  );
  const activeOptionId =
    requestedActiveOptionId !== null &&
    visibleOptions.some((option) => option.id === requestedActiveOptionId) &&
    canFocusNestedPanelOption({
      optionId: requestedActiveOptionId,
      selection: props.selection,
      sessionReadOnly,
    })
      ? requestedActiveOptionId
      : selectionDefaultPanelId;
  const activeOption =
    activeOptionId === null ? null : visibleOptions.find((option) => option.id === activeOptionId) ?? null;
  const activeChildSelections = activeOption === null ? [] : props.selection.childSelections[activeOption.id] ?? [];
  const guidanceMessage =
    activeOption === null
      ? null
      : resolveNestedGuidanceMessage({
          guidanceOverride: props.guidance,
          hasParentSelected: props.selection.selectedOptionIds.includes(activeOption.id),
          question: props.question,
          supportsSingleSelectCascade,
        });
  return (
    <section className={cn(WIZARD_UI.sectionMt, WIZARD_UI.sectionStack)}>
      <div>
        <h2 className={WIZARD_UI.questionTitle}>{props.question.prompt}</h2>
        {props.question.description !== null ? (
          <p className={cn('mt-1.5 md:mt-2', WIZARD_UI.questionDesc)}>{props.question.description}</p>
        ) : null}
      </div>
      <div className={cn('grid xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.25fr)]', WIZARD_UI.gridGapLg)}>
        <div className="space-y-2 md:space-y-3">
          {visibleOptions.map((option, optionIndex) => {
            const isInSelectedPath = props.selection.selectedOptionIds.includes(option.id);
            const isSelected = terminalSelectedOptionId !== null ? terminalSelectedOptionId === option.id : isInSelectedPath;
            const isActive = activeOption?.id === option.id;
            const canFocusPanel = canFocusNestedPanelOption({
              optionId: option.id,
              selection: props.selection,
              sessionReadOnly,
            });
            const isCategoryDisabled = sessionReadOnly && !canFocusPanel;
            return (
              <button
                key={option.id}
                type="button"
                disabled={isCategoryDisabled}
                aria-pressed={isSelected}
                onClick={() => {
                  if (sessionReadOnly) {
                    if (canFocusPanel) {
                      setRequestedActiveOptionId(option.id);
                    }
                    return;
                  }
                  props.onToggleOption(option.id);
                  setRequestedActiveOptionId(option.id);
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl border bg-card px-3 py-3 text-left shadow-xs transition-all md:gap-4 md:rounded-2xl md:px-4 md:py-4',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isActive || isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                    : isInSelectedPath
                      ? 'border-primary/35 bg-primary/5'
                    : 'border-border hover:border-primary/25 hover:bg-muted/30',
                  isCategoryDisabled && 'cursor-not-allowed opacity-60 hover:border-border hover:bg-card',
                )}
              >
                <div className="flex w-full items-start gap-3 md:gap-4">
                  <DiagnosticOptionIcon iconName={option.presentation.icon} optionIndex={optionIndex} />
                  <div className="min-w-0 flex-1 space-y-1.5 md:space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(WIZARD_UI.optionTitle, 'min-w-0')}>{getDisplayOptionTitle(option)}</p>
                      <span
                        className={cn(
                          WIZARD_UI.selectIndicator,
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isInSelectedPath
                              ? 'border-primary/50 bg-primary/10 text-primary'
                              : 'border-border bg-background text-transparent',
                        )}
                        aria-hidden
                      >
                        {isSelected ? (
                          <Check className="size-3.5 md:size-4" />
                        ) : isInSelectedPath ? (
                          <span className="size-1.5 rounded-full bg-primary md:size-2" />
                        ) : (
                          <Check className="size-3.5 md:size-4" />
                        )}
                      </span>
                    </div>
                    {getDisplayOptionSupportingText(option) !== null ? (
                      <p className={WIZARD_UI.optionSupporting}>{getDisplayOptionSupportingText(option)}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className={WIZARD_UI.panelShell}>
          {activeOption === null ? (
            <div
              className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center md:min-h-[220px] md:gap-3 md:rounded-2xl md:px-6 md:py-10"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm font-medium text-foreground md:text-base">Choose a category first</p>
              <p className="max-w-sm text-pretty text-sm text-muted-foreground">
                Select a category. Follow-up choices for that category will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 md:gap-4">
                <DiagnosticOptionIcon
                  iconName={activeOption.presentation.icon}
                  optionIndex={visibleOptions.findIndex((option) => option.id === activeOption.id)}
                />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-2xl">
                    {activeOption.presentation.panelTitle ?? getDisplayOptionTitle(activeOption)}
                  </h3>
                  {activeOption.childQuestion !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground md:mt-2 md:text-sm">
                      {activeOption.childQuestion.prompt}
                    </p>
                  ) : null}
                </div>
              </div>
              {activeOption.childQuestion !== null ? (
                <div className="mt-4 space-y-2 md:mt-6 md:space-y-3">
                  {activeOption.childQuestion.options.map((childOption) => {
                    const isSelected = activeChildSelections.includes(childOption.id);
                    return (
                      <button
                        key={childOption.id}
                        type="button"
                        disabled={
                          sessionReadOnly || !props.selection.selectedOptionIds.includes(activeOption.id)
                        }
                        onClick={() => props.onToggleChildOption(activeOption.id, childOption.id)}
                        className={cn(
                          'flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-3 text-left transition-all md:gap-3 md:rounded-2xl md:px-4 md:py-4',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                            : 'border-border bg-background hover:border-primary/30',
                          !props.selection.selectedOptionIds.includes(activeOption.id) && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <span>
                          <span className="block text-sm font-medium text-foreground md:text-base">{childOption.label}</span>
                          {childOption.description !== null ? (
                            <span className="mt-1 block text-sm text-muted-foreground">{childOption.description}</span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            WIZARD_UI.selectIndicator,
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-transparent',
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5 md:size-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground md:mt-6 md:rounded-2xl md:px-4 md:py-6">
                  Add a follow-up question to this option in the template editor to show detailed choices here.
                </div>
              )}
              {guidanceMessage !== null ? (
                <div className="mt-4 rounded-xl border border-border/70 bg-amber-50 px-3 py-3 text-sm text-amber-900 md:mt-6 md:rounded-2xl md:px-4 md:py-4">
                  {guidanceMessage}
                </div>
              ) : null}
            </>
          )}
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
        'cursor-grab rounded-xl border border-border bg-background p-3 shadow-xs transition-shadow active:cursor-grabbing md:rounded-2xl md:p-4',
        isDragging && 'border-primary/40 bg-primary/5 shadow-sm',
      )}
    >
      <div className="flex items-start gap-2.5 md:gap-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground md:size-9 md:rounded-xl md:text-sm">
          {props.index + 1}
        </span>
        <DiagnosticOptionIcon iconName={props.option.presentation.icon} optionIndex={props.index} />
        <div className="min-w-0 flex-1">
          <p className={cn(WIZARD_UI.optionTitle)}>{getDisplayOptionTitle(props.option)}</p>
          {getDisplayOptionSupportingText(props.option) !== null ? (
            <p className={cn('mt-0.5 md:mt-1', WIZARD_UI.optionSupporting)}>{getDisplayOptionSupportingText(props.option)}</p>
          ) : null}
        </div>
        <span className="hidden rounded-lg border border-border bg-card p-1.5 text-muted-foreground sm:inline-flex md:p-2">
          <ArrowUpDown className="size-3.5 md:size-4" aria-hidden />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2 md:mt-4">
        <Button type="button" variant="outline" size="sm" onClick={props.onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function RankedOptionRankBadge(props: { readonly rank: number }): ReactElement {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold tabular-nums text-primary-foreground md:hidden"
      aria-hidden
    >
      {props.rank}
    </span>
  );
}

function RankedOptionsRoundRenderer(props: {
  readonly baseAnswers: Readonly<Record<string, DiagnosticQuestionSelection>>;
  readonly onSelectionChange: (nextSelection: DiagnosticQuestionSelection) => void;
  readonly question: DiagnosticQuestionBlock;
  readonly rankedOptionLimit: number;
  readonly selection: DiagnosticQuestionSelection;
  readonly sessionReadOnly?: boolean;
}): ReactElement {
  const sessionReadOnly = props.sessionReadOnly === true;
  const visibleOptions = useMemo(
    () =>
      getVisibleQuestionOptions({
        baseAnswers: props.baseAnswers,
        question: props.question,
        selection: props.selection,
      }),
    [props.baseAnswers, props.question, props.selection],
  );
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
  const pickerOptions = useMemo(() => {
    const selected = selectedOptionIds.flatMap((optionId) => {
      const option = visibleOptions.find((candidate) => candidate.id === optionId);
      return option === undefined ? [] : [option];
    });
    const unselected = visibleOptions.filter((option) => !selectedOptionIds.includes(option.id));
    return [...selected, ...unselected];
  }, [selectedOptionIds, visibleOptions]);

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
    <section className={cn(WIZARD_UI.sectionMt, WIZARD_UI.sectionStack)}>
      <div>
        <h2 className={WIZARD_UI.questionTitle}>{props.question.prompt}</h2>
        {props.question.description !== null ? (
          <p className={cn('mt-1.5 md:mt-2', WIZARD_UI.questionDesc)}>{props.question.description}</p>
        ) : null}
        <div className="mt-2 rounded-xl border border-border bg-muted/25 px-3 py-2.5 text-xs text-foreground md:mt-3 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
          <span className="md:hidden">
            Select your top <span className="font-semibold">{props.rankedOptionLimit}</span> outcomes, then use the
            arrows to set rank order.
          </span>
          <span className="hidden md:inline">
            Drag and drop to rank your top <span className="font-semibold">{props.rankedOptionLimit}</span> outcomes.
          </span>
        </div>
      </div>
      <div className={cn('grid xl:grid-cols-[minmax(280px,1fr)_minmax(0,1fr)]', WIZARD_UI.gridGapLg)}>
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs md:rounded-3xl md:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground md:text-sm">Choose the outcomes you want to rank</p>
            <p className="text-xs font-medium text-primary md:hidden">
              {selectedOptionIds.length} / {props.rankedOptionLimit} selected
            </p>
          </div>
          <div className="mt-3 space-y-2 md:mt-4 md:space-y-3">
            {pickerOptions.map((option) => {
              const optionIndex = visibleOptions.findIndex((candidate) => candidate.id === option.id);
              const selectedRankIndex = selectedRankLookup.get(option.id);
              const isSelected = selectedRankIndex !== undefined;
              const isAtLimit = selectedOptionIds.length >= props.rankedOptionLimit;
              const isDisabled = sessionReadOnly || (isSelected === false && isAtLimit);
              return (
              <div
                key={option.id}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) {
                    return;
                  }
                  if (isSelected) {
                    executeRemoveOption(option.id);
                  } else {
                    executeAddOption(option.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (isDisabled) {
                    return;
                  }
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }
                  event.preventDefault();
                  if (isSelected) {
                    executeRemoveOption(option.id);
                  } else {
                    executeAddOption(option.id);
                  }
                }}
                className={cn(
                  'relative flex w-full items-start gap-2.5 rounded-xl border bg-background px-3 py-3 text-left transition-all md:gap-4 md:rounded-2xl md:px-4 md:py-4',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isSelected && 'border-primary/50 bg-primary/5 shadow-xs',
                  isDisabled
                    ? 'cursor-not-allowed opacity-60'
                    : isSelected
                      ? 'border-primary/50 hover:border-primary/60 hover:bg-primary/10'
                      : 'border-border hover:border-primary/30 hover:bg-muted/20',
                )}
              >
                <div className="flex w-full items-start gap-2 md:gap-4">
                  {isSelected && selectedRankIndex !== undefined ? (
                    <RankedOptionRankBadge rank={selectedRankIndex + 1} />
                  ) : null}
                  <DiagnosticOptionIcon iconName={option.presentation.icon} optionIndex={optionIndex} />
                  <div className="min-w-0 flex-1 space-y-1.5 md:space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:gap-2">
                        <p className={WIZARD_UI.optionTitle}>
                          {isSelected
                            ? getDisplayOptionTitle(option)
                            : `${optionIndex + 1}. ${getDisplayOptionTitle(option)}`}
                        </p>
                        {option.presentation.badgeText !== null ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 md:px-2 md:py-1 md:text-[11px]">
                            {option.presentation.badgeText}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isSelected && selectedRankIndex !== undefined && !sessionReadOnly ? (
                          <div
                            className="flex flex-col gap-0.5 md:hidden"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            role="group"
                            aria-label={`Reorder ${getDisplayOptionTitle(option)}`}
                          >
                            <button
                              type="button"
                              disabled={selectedRankIndex === 0}
                              onClick={() => executeMoveOption(option.id, -1)}
                              className={cn(
                                'flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                                'disabled:cursor-not-allowed disabled:opacity-40',
                              )}
                              aria-label={`Move ${getDisplayOptionTitle(option)} up`}
                            >
                              <ChevronUp className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              disabled={selectedRankIndex === selectedOptionIds.length - 1}
                              onClick={() => executeMoveOption(option.id, 1)}
                              className={cn(
                                'flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                                'disabled:cursor-not-allowed disabled:opacity-40',
                              )}
                              aria-label={`Move ${getDisplayOptionTitle(option)} down`}
                            >
                              <ChevronDown className="size-4" aria-hidden />
                            </button>
                          </div>
                        ) : null}
                        <span
                          className={cn(
                            WIZARD_UI.selectIndicator,
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-transparent',
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5 md:size-4" />
                        </span>
                      </div>
                    </div>
                    {getDisplayOptionSupportingText(option) !== null ? (
                      <p className={WIZARD_UI.optionSupporting}>{getDisplayOptionSupportingText(option)}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
        <div className="hidden rounded-2xl border border-border bg-card p-3.5 shadow-xs md:block md:rounded-3xl md:p-5">
          <div className="flex items-center justify-between gap-2 md:gap-3">
            <p className="text-xs font-semibold text-foreground md:text-sm">Your Top Outcomes (rank {props.rankedOptionLimit})</p>
            <p className="text-sm font-medium text-primary">
              {selectedOptionIds.length} / {props.rankedOptionLimit} selected
            </p>
          </div>
          <div className="mt-3 md:mt-4">
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
                      className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground md:rounded-2xl md:px-4 md:py-5"
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
  /**
   * When true, do not inject the first template round into an empty guided state. Use for `/diagnostic/[sessionRef]` so a
   * brief empty render (or Strict Mode fetch abort) is never overwritten before session hydration applies.
   */
  readonly suppressEmptyTemplateBootstrap?: boolean;
  /** Booking-linked session: review only, no API writes or starting a new run from this screen. */
  readonly sessionReadOnly?: boolean;
  /** Quiz session ref for booking after service selection (`/book/[sessionRef]?serviceKey=…`). */
  readonly marketingBookSessionRef?: string | null;
  /**
   * When set, `/api/quiz/diagnostic-template` is scoped to this session so the pinned template is used on revisit
   * even if the admin activated a different template later.
   */
  readonly templateSessionMarketingRef?: string | null;
  readonly onGoBack: () => void;
  readonly onGuidedChange: Dispatch<SetStateAction<GuidedDiagnosticV1>>;
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
  readonly briefAssessment?: string;
  readonly sessionTitle?: string;
  readonly goodFitBullets?: readonly string[];
  readonly recommendedServiceKey?: string;
  readonly mappedSituation?: string;
  readonly error?: string;
  readonly details?: string;
};

export function GuidedDiagnosticWizard(props: GuidedDiagnosticWizardProps): ReactElement {
  const {
    backLabel,
    canGoBack,
    guided,
    onGoBack,
    onGuidedChange,
    suppressEmptyTemplateBootstrap = false,
    sessionReadOnly = false,
    marketingBookSessionRef = null,
    templateSessionMarketingRef = null,
  } = props;
  const executeGoBackWithScroll = useCallback((): void => {
    onGoBack();
    scheduleScrollQuizWizardToTop();
  }, [onGoBack]);
  const [isAwaitingApi, setIsAwaitingApi] = useState<boolean>(false);
  const [diagnosticDebugLog, setDiagnosticDebugLog] = useState<DiagnosticDebugLogEntry[]>([]);
  const [cacheDebugUiEnabled, setCacheDebugUiEnabled] = useState<boolean>(false);
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(false);
  const [activeTemplate, setActiveTemplate] = useState<PublicDiagnosticTemplateValue | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const hasAppliedTemplateBootstrapRef = useRef<boolean>(false);
  const hasAppliedReadOnlyPeekRef = useRef<boolean>(false);
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
        const trimmedRef = templateSessionMarketingRef?.trim() ?? '';
        const templateUrl =
          trimmedRef.length > 0
            ? `${DIAGNOSTIC_TEMPLATE_API_URL}?sessionId=${encodeURIComponent(trimmedRef)}`
            : DIAGNOSTIC_TEMPLATE_API_URL;
        const templateResponse = await fetch(templateUrl);
        const templateData = (await templateResponse.json()) as DiagnosticTemplateApiBody;
        if (cancelled) {
          return;
        }
        setActiveTemplate(templateData.template ?? null);
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
  }, [templateSessionMarketingRef]);
  useEffect(() => {
    hasAppliedTemplateBootstrapRef.current = false;
  }, [templateSessionMarketingRef]);
  useEffect(() => {
    if (isGuidedStateEmptyForTemplateBootstrap(guided)) {
      hasAppliedTemplateBootstrapRef.current = false;
    }
  }, [guided]);
  useEffect(() => {
    if (suppressEmptyTemplateBootstrap) {
      return;
    }
    if (diagnosticAiEnabled || isLoadingConfig || initialTemplateRound === null) {
      return;
    }
    if (hasAppliedTemplateBootstrapRef.current) {
      return;
    }
    onGuidedChange((previous) => {
      if (!isGuidedStateEmptyForTemplateBootstrap(previous)) {
        return previous;
      }
      hasAppliedTemplateBootstrapRef.current = true;
      return {
        ...previous,
        activeRound: initialTemplateRound,
        outcome: null,
      };
    });
  }, [diagnosticAiEnabled, initialTemplateRound, isLoadingConfig, onGuidedChange, suppressEmptyTemplateBootstrap]);
  useEffect(() => {
    if (!sessionReadOnly) {
      hasAppliedReadOnlyPeekRef.current = false;
      return;
    }
    if (hasAppliedReadOnlyPeekRef.current) {
      return;
    }
    onGuidedChange((previous) => {
      if (previous.activeRound !== null || previous.outcome !== null || previous.completedBundles.length === 0) {
        return previous;
      }
      const nextGuided = applyGuidedPeekCompletedBundleIndex(previous, 0);
      if (nextGuided === null) {
        return previous;
      }
      hasAppliedReadOnlyPeekRef.current = true;
      return nextGuided;
    });
  }, [onGuidedChange, sessionReadOnly]);
  const executeUpdatePrompt = useCallback(
    (value: string): void => {
      if (sessionReadOnly) {
        return;
      }
      onGuidedChange((previous) => ({
        ...previous,
        initialPrompt: value,
      }));
    },
    [onGuidedChange, sessionReadOnly],
  );
  const executeToggleSeedChip = useCallback(
    (phrase: string): void => {
      if (sessionReadOnly) {
        return;
      }
      onGuidedChange((previous) => ({
        ...previous,
        initialPrompt: togglePromptWithSeed(previous.initialPrompt, phrase),
      }));
    },
    [onGuidedChange, sessionReadOnly],
  );
  const executeSelectOption = useCallback(
    (question: DiagnosticQuestionBlock, optionId: string): void => {
      if (sessionReadOnly) {
        return;
      }
      onGuidedChange((previous) => {
        if (previous.activeRound === null) {
          return previous;
        }
        const baseAnswers = buildDiagnosticAnswerLookup({
          completedBundles: previous.completedBundles,
          activeRound: previous.activeRound,
        });
        const nextSelection = toggleQuestionOptionSelection({
          baseAnswers,
          question,
          selection: previous.activeRound.answers[question.id],
          optionId,
        });
        let nextActiveRound = synchronizeActiveRound({
          completedBundles: previous.completedBundles,
          activeRound: {
            ...previous.activeRound,
            answers: {
              ...previous.activeRound.answers,
              [question.id]: nextSelection,
            },
          },
        });
        if (nextActiveRound === null) {
          return previous;
        }
        if (
          !shouldShowQuestionDetailNoteInput({
            baseAnswers,
            question,
            selection: nextSelection,
          })
        ) {
          const nextAnswerNotes = { ...nextActiveRound.answerNotes };
          delete nextAnswerNotes[question.id];
          nextActiveRound = {
            ...nextActiveRound,
            answerNotes: nextAnswerNotes,
          };
        }
        return {
          ...previous,
          activeRound: nextActiveRound,
        };
      });
    },
    [onGuidedChange, sessionReadOnly],
  );
  const executeSelectChildOption = useCallback(
    (question: DiagnosticQuestionBlock, parentOptionId: string, childOptionId: string): void => {
      if (sessionReadOnly) {
        return;
      }
      onGuidedChange((previous) => {
        if (previous.activeRound === null) {
          return previous;
        }
        const nextSelection = toggleChildQuestionOptionSelection({
          baseAnswers: buildDiagnosticAnswerLookup({
            completedBundles: previous.completedBundles,
            activeRound: previous.activeRound,
          }),
          question,
          selection: previous.activeRound.answers[question.id],
          parentOptionId,
          childOptionId,
        });
        const nextActiveRound = synchronizeActiveRound({
          completedBundles: previous.completedBundles,
          activeRound: {
            ...previous.activeRound,
            answers: {
              ...previous.activeRound.answers,
              [question.id]: nextSelection,
            },
          },
        });
        if (nextActiveRound === null) {
          return previous;
        }
        return {
          ...previous,
          activeRound: nextActiveRound,
        };
      });
    },
    [onGuidedChange, sessionReadOnly],
  );
  const executeSetQuestionSelection = useCallback(
    (questionId: string, nextSelection: DiagnosticQuestionSelection): void => {
      if (sessionReadOnly) {
        return;
      }
      onGuidedChange((previous) => {
        if (previous.activeRound === null) {
          return previous;
        }
        const questionBlock = previous.activeRound.questions.find((candidate) => candidate.id === questionId);
        const baseAnswers = buildDiagnosticAnswerLookup({
          completedBundles: previous.completedBundles,
          activeRound: previous.activeRound,
        });
        let nextActiveRound = synchronizeActiveRound({
          completedBundles: previous.completedBundles,
          activeRound: {
            ...previous.activeRound,
            answers: {
              ...previous.activeRound.answers,
              [questionId]: nextSelection,
            },
          },
        });
        if (nextActiveRound === null) {
          return previous;
        }
        if (
          questionBlock !== undefined &&
          !shouldShowQuestionDetailNoteInput({
            baseAnswers,
            question: questionBlock,
            selection: nextSelection,
          })
        ) {
          const nextAnswerNotes = { ...nextActiveRound.answerNotes };
          delete nextAnswerNotes[questionId];
          nextActiveRound = {
            ...nextActiveRound,
            answerNotes: nextAnswerNotes,
          };
        }
        return {
          ...previous,
          activeRound: nextActiveRound,
        };
      });
    },
    [onGuidedChange, sessionReadOnly],
  );
  const executeUpdateAnswerNote = useCallback(
    (questionId: string, value: string): void => {
      if (sessionReadOnly) {
        return;
      }
      const capped =
        value.length > MAX_ANSWER_NOTE_LENGTH ? value.slice(0, MAX_ANSWER_NOTE_LENGTH) : value;
      onGuidedChange((previous) => {
        if (previous.activeRound === null) {
          return previous;
        }
        return {
          ...previous,
          activeRound: {
            ...previous.activeRound,
            answerNotes: {
              ...previous.activeRound.answerNotes,
              [questionId]: capped,
            },
          },
        };
      });
    },
    [onGuidedChange, sessionReadOnly],
  );
  const executeFetchRound = useCallback(
    async (completedBundles: CompletedRoundBundle[]): Promise<boolean> => {
      if (sessionReadOnly) {
        return false;
      }
      const trimmed = guided.initialPrompt.trim();
      const clientEmptyRoundRetryLimit = 3;
      for (let attempt = 0; attempt <= clientEmptyRoundRetryLimit; attempt += 1) {
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
            notifyError('Add OPENAI_API_KEY to enable guided intake.');
          } else {
            const hint = typeof data.details === 'string' ? ` ${data.details}` : '';
            notifyError(`${data.error ?? 'Something went wrong. Try again.'}${hint}`);
          }
          return false;
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
            sessionTitle: resolveProjectRescueSessionTitle(
              typeof data.sessionTitle === 'string' ? data.sessionTitle : null,
            ),
            briefAssessment: resolveProjectRescueBriefAssessment(
              typeof data.briefAssessment === 'string' ? data.briefAssessment : null,
            ),
            goodFitBullets: resolveProjectRescueGoodFitBullets(
              Array.isArray(data.goodFitBullets) ? data.goodFitBullets : null,
            ),
            recommendedServiceKey: inferRecommendedServiceKeyFromContext({
              mappedSituation,
              initialPrompt: guided.initialPrompt,
              advisorSummary,
            }),
          };
          onGuidedChange((previous) => ({
            ...previous,
            completedBundles,
            activeRound: null,
            outcome,
          }));
          return true;
        }
        const mappedQuestions: DiagnosticQuestionBlock[] = (Array.isArray(data.questions) ? data.questions : [])
          .map((row) => ({
            id: row.id,
            prompt: row.prompt,
            description: null,
            showWhen: null,
            type: 'multiple-choice' as const,
            rankedOptionLimit: null,
            selectionMode: 'single' as const,
            options: normalizeDiagnosticOptions(row.options),
          }))
          .filter((block) => block.options.length > 0);
        if (mappedQuestions.length > 0) {
          onGuidedChange((previous) => ({
            ...previous,
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
          }));
          return true;
        }
        if (attempt === clientEmptyRoundRetryLimit) {
          notifyError('No follow-up questions were returned. Try again.');
          return false;
        }
      }
      return false;
    },
    [cacheDebugUiEnabled, guided, onGuidedChange, sessionReadOnly],
  );
  const executeFetchTemplateSummary = useCallback(
    async (completedBundles: CompletedRoundBundle[]): Promise<GuidedDiagnosticOutcome> => {
      if (sessionReadOnly) {
        throw new Error('This diagnostic is view-only.');
      }
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
          '',
          '',
          null,
          'project-rescue',
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
        data.briefAssessment ?? '',
        data.sessionTitle ?? '',
        Array.isArray(data.goodFitBullets) ? data.goodFitBullets : null,
        data.recommendedServiceKey ?? 'project-rescue',
      );
    },
    [activeTemplate, guided.initialPrompt, sessionReadOnly],
  );
  const executeStartFromPrompt = useCallback(async (): Promise<void> => {
    if (sessionReadOnly) {
      return;
    }
    const trimmed = guided.initialPrompt.trim();
    if (trimmed.length < MIN_PROMPT_LENGTH) {
      notifyError(`Add a bit more detail (at least ~${MIN_PROMPT_LENGTH} characters) so we can tailor questions.`);
      return;
    }
    setIsAwaitingApi(true);
    try {
      await executeFetchRound([]);
    } finally {
      setIsAwaitingApi(false);
    }
  }, [executeFetchRound, guided.initialPrompt, sessionReadOnly]);
  const executeAdvanceOrSubmitRound = useCallback(async (): Promise<void> => {
    if (guided.activeRound === null) {
      return;
    }
    if (sessionReadOnly) {
      const activeRound = synchronizeActiveRound({
        activeRound: guided.activeRound,
        completedBundles: guided.completedBundles,
      });
      if (activeRound === null) {
        return;
      }
      const priorAnswersOnly = buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
      });
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
        notifyError(validation.message ?? 'Pick an option above or type your exact answer below.');
        return;
      }
      const nextQuestionIndex = findNextVisibleQuestionIndex({
        questions: activeRound.questions,
        baseAnswers: priorAnswersOnly,
        answers: activeRound.answers,
        currentIndex: activeRound.stepIndex,
      });
      if (nextQuestionIndex !== null) {
        onGuidedChange((previous) => ({
          ...previous,
          activeRound: {
            ...activeRound,
            stepIndex: nextQuestionIndex,
          },
        }));
        scheduleScrollQuizWizardToTop();
        return;
      }
      const bundleIndex = guided.completedBundles.findIndex((bundle) => bundle.roundIndex === activeRound.roundIndex);
      const nextBundleIndex = bundleIndex >= 0 ? bundleIndex + 1 : guided.completedBundles.length;
      if (nextBundleIndex < guided.completedBundles.length) {
        const peeked = applyGuidedPeekCompletedBundleIndex(guided, nextBundleIndex);
        if (peeked !== null) {
          onGuidedChange(() => peeked);
        }
        scheduleScrollQuizWizardToTop();
        return;
      }
      if (guided.outcome !== null) {
        onGuidedChange((previous) => ({
          ...previous,
          activeRound: null,
        }));
        scheduleScrollQuizWizardToTop();
      }
      return;
    }
    const activeRound = synchronizeActiveRound({
      activeRound: guided.activeRound,
      completedBundles: guided.completedBundles,
    });
    if (activeRound === null) {
      return;
    }
    const priorAnswersOnly = buildDiagnosticAnswerLookup({
      completedBundles: guided.completedBundles,
    });
    const answerableQuestionIndexes = getVisibleQuestionIndexes({
      questions: activeRound.questions,
      baseAnswers: priorAnswersOnly,
      answers: activeRound.answers,
    });
    if (answerableQuestionIndexes.length === 0) {
      if (!diagnosticAiEnabled) {
        if (activeTemplate === null) {
          notifyError('AI Diagnostic is off, but no active template is ready yet.');
          return;
        }
        const nextRound = buildNextTemplateRoundFromState({
          template: activeTemplate,
          completedBundles: guided.completedBundles,
          startRoundIndex: activeRound.roundIndex + 1,
        });
        if (nextRound !== null) {
          onGuidedChange((previous) => ({
            ...previous,
            activeRound: nextRound,
            outcome: null,
          }));
          scheduleScrollQuizWizardToTop();
          return;
        }
        setIsAwaitingApi(true);
        try {
          const outcome = await executeFetchTemplateSummary(guided.completedBundles);
          onGuidedChange((previous) => ({
            ...previous,
            activeRound: null,
            outcome,
          }));
          scheduleScrollQuizWizardToTop();
        } catch (error: unknown) {
          notifyError(error instanceof Error ? error.message : 'Failed to generate advisor summary.');
        } finally {
          setIsAwaitingApi(false);
        }
        return;
      }
      setIsAwaitingApi(true);
      try {
        const didAdvance = await executeFetchRound(guided.completedBundles);
        if (didAdvance) {
          scheduleScrollQuizWizardToTop();
        }
      } finally {
        setIsAwaitingApi(false);
      }
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
      notifyError(validation.message ?? 'Pick an option above or type your exact answer below.');
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
      onGuidedChange((previous) => ({
        ...previous,
        activeRound: {
          ...activeRound,
          stepIndex: nextQuestionIndex,
        },
      }));
      scheduleScrollQuizWizardToTop();
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
        notifyError('AI Diagnostic is off, but no active template is ready yet.');
        return;
      }
      const nextRound = buildNextTemplateRoundFromState({
        template: activeTemplate,
        completedBundles: nextCompleted,
        startRoundIndex: activeRound.roundIndex + 1,
      });
      if (nextRound !== null) {
        onGuidedChange((previous) => ({
          ...previous,
          completedBundles: nextCompleted,
          activeRound: nextRound,
          outcome: null,
        }));
        scheduleScrollQuizWizardToTop();
        return;
      }
      setIsAwaitingApi(true);
      try {
        const outcome = await executeFetchTemplateSummary(nextCompleted);
        onGuidedChange((previous) => ({
          ...previous,
          completedBundles: nextCompleted,
          activeRound: null,
          outcome,
        }));
        scheduleScrollQuizWizardToTop();
      } catch (error: unknown) {
        notifyError(error instanceof Error ? error.message : 'Failed to generate advisor summary.');
      } finally {
        setIsAwaitingApi(false);
      }
      return;
    }
    setIsAwaitingApi(true);
    try {
      const didAdvance = await executeFetchRound(nextCompleted);
      if (didAdvance) {
        scheduleScrollQuizWizardToTop();
      }
    } finally {
      setIsAwaitingApi(false);
    }
  }, [activeTemplate, diagnosticAiEnabled, executeFetchRound, executeFetchTemplateSummary, guided, onGuidedChange, sessionReadOnly]);
  const executeOpenDiagnosticReview = useCallback((): void => {
    onGuidedChange((previous) => {
      if (previous.completedBundles.length > 0) {
        const peeked = applyGuidedPeekCompletedBundleIndex(previous, 0);
        return peeked ?? previous;
      }
      return {
        ...previous,
        activeRound: null,
        outcome: null,
      };
    });
    scheduleScrollQuizWizardToTop();
  }, [onGuidedChange]);
  if (guided.outcome !== null && guided.activeRound === null) {
    return (
      <div>
        <DiagnosticCacheDebugPanel
          showDebugUi={cacheDebugUiEnabled}
          entries={diagnosticDebugLog}
          onClear={() => setDiagnosticDebugLog([])}
        />
        <DiagnosticOutcomePanel
          outcome={guided.outcome}
          initialPrompt={guided.initialPrompt}
          sessionReadOnly={sessionReadOnly}
          marketingBookSessionRef={marketingBookSessionRef ?? null}
          onReviewDiagnostic={executeOpenDiagnosticReview}
        />
      </div>
    );
  }
  if (sessionReadOnly) {
    const hasGuidedSnapshot =
      guided.activeRound !== null ||
      guided.completedBundles.length > 0 ||
      guided.outcome !== null ||
      guided.initialPrompt.trim().length > 0;
    if (!hasGuidedSnapshot) {
      return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-foreground">
          <p className="font-medium">Saved answers could not be loaded</p>
          <p className="mt-2 text-muted-foreground">
            Try opening the diagnostic again from My diagnostics. If this keeps happening, contact support.
          </p>
          <Button type="button" className="mt-4" variant="outline" asChild>
            <Link href="/account/diagnostics">My diagnostics</Link>
          </Button>
        </div>
      );
    }
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
            : 'Continue: Recommendation'
          : 'Submit round';
    const isFirstVisibleQuestionInRound: boolean = positionInRound === 1;
    const shouldShowDetailNoteTextbox =
      question !== undefined &&
      shouldShowQuestionDetailNoteInput({
        baseAnswers: optionBaseAnswers,
        question,
        selection: questionSelection,
      });
    return (
      <div>
        <DiagnosticCacheDebugPanel
          showDebugUi={cacheDebugUiEnabled}
          entries={diagnosticDebugLog}
          onClear={() => setDiagnosticDebugLog([])}
        />
        {isFirstVisibleQuestionInRound ? (
          <p className="mt-2 text-pretty text-muted-foreground">
            {question?.type === 'ranked-options'
              ? 'Rank the outcomes that matter most. Your progress is saved, so refresh or use Back and you will return to the same step.'
              : question?.type === 'nested-options'
                ? 'Choose one or more categories first, then answer the detailed options that appear in the right-hand panel. Your progress is saved automatically.'
                : 'Answer one question at a time. Your progress is saved, so refresh or use Back and you will return to the same step.'}
          </p>
        ) : null}
        <p
          className={cn(
            'text-sm text-muted-foreground',
            isFirstVisibleQuestionInRound ? 'mt-3 md:mt-4' : 'mt-1.5 md:mt-2',
          )}
        >
          Question {positionInRound} of {roundSize} · {activeRound.roundTitle}
        </p>
        {showGuidance ? (
          <p className="mt-4 text-sm font-medium text-foreground">{activeRound.guidance}</p>
        ) : null}
        {question !== undefined ? (
          <>
            {question.type === 'nested-options' ? (
              <NestedOptionsRoundRenderer
                key={question.id}
                baseAnswers={optionBaseAnswers}
                guidance={activeRound.guidance}
                question={question}
                selection={questionSelection}
                sessionReadOnly={sessionReadOnly}
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
                sessionReadOnly={sessionReadOnly}
                onSelectionChange={(nextSelection) => executeSetQuestionSelection(question.id, nextSelection)}
              />
            ) : (
              <MultipleChoiceRoundRenderer
                baseAnswers={optionBaseAnswers}
                question={question}
                selection={questionSelection}
                sessionReadOnly={sessionReadOnly}
                onToggleOption={(optionId) => executeSelectOption(question, optionId)}
                onToggleChildOption={(parentOptionId, childOptionId) =>
                  executeSelectChildOption(question, parentOptionId, childOptionId)
                }
              />
            )}
            {shouldShowDetailNoteTextbox ? (
              <div className="mt-4 md:mt-6">
                <label
                  htmlFor={`diagnostic-exact-answer-${question.id}`}
                  className="text-sm font-medium text-foreground"
                >
                  Your exact answer
                  <span className="ml-1.5 font-normal text-destructive" aria-hidden>
                    (required)
                  </span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  This question asks for specifics when you pick this path. Add versions, errors, timing, or anything
                  your advisor must know before the call.
                </p>
                <Textarea
                  id={`diagnostic-exact-answer-${question.id}`}
                  value={activeRound.answerNotes[question.id] ?? ''}
                  onChange={(event) => executeUpdateAnswerNote(question.id, event.target.value)}
                  disabled={isAwaitingApi}
                  rows={3}
                  maxLength={MAX_ANSWER_NOTE_LENGTH}
                  required
                  aria-required={true}
                  placeholder="Type the precise answer or extra detail for your advisor…"
                  className="mt-2 rounded-xl border-border bg-card shadow-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {noteCharactersRemaining} characters left
                </p>
              </div>
            ) : null}
          </>
        ) : null}
        {isAwaitingApi ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground md:mt-8">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            {diagnosticAiEnabled ? 'Updating your diagnostic…' : 'Preparing your advisor summary…'}
          </div>
        ) : (
          <div className={cn(WIZARD_UI.footerMt, "flex flex-wrap items-center justify-between gap-3")}>
            <div>
              {canGoBack ? (
                <Button type="button" variant="outline" onClick={executeGoBackWithScroll}>
                  <span className="sm:hidden">Back</span>
                  <span className="hidden sm:inline">{backLabel}</span>
                </Button>
              ) : null}
            </div>
            <Button type="button" onClick={() => void executeAdvanceOrSubmitRound()}>
              <span className="sm:hidden">Continue</span>
              <span className="hidden sm:inline">{advanceLabel}</span>
            </Button>
          </div>
        )}
      </div>
    );
  }
  if (!diagnosticAiEnabled) {
    const isAwaitingFirstTemplateRoundBootstrap =
      !suppressEmptyTemplateBootstrap &&
      initialTemplateRound !== null &&
      guided.activeRound === null &&
      guided.completedBundles.length === 0 &&
      guided.outcome === null;
    if (isLoadingConfig || isAwaitingFirstTemplateRoundBootstrap) {
      return (
        <div>
          <p className="mt-2 text-pretty text-muted-foreground">
            Preparing your diagnostic template and saving your progress automatically.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground md:mt-8">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            Opening the active template…
          </div>
        </div>
      );
    }
    if (activeTemplate === null || initialTemplateRound === null) {
      return (
        <div>
          <p className="mt-2 text-pretty text-muted-foreground">
            Template mode is active, but there is no usable active template yet.
          </p>
          <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground md:mt-4 md:rounded-2xl md:px-4 md:py-3">
            Ask an admin to create and activate a diagnostic template before customers start this flow.
          </div>
        </div>
      );
    }
  }
  return (
    <div>
      <DiagnosticCacheDebugPanel
        showDebugUi={cacheDebugUiEnabled}
        entries={diagnosticDebugLog}
        onClear={() => setDiagnosticDebugLog([])}
      />
      <p className="mt-2 text-pretty text-muted-foreground">
        {sessionReadOnly ? (
          <>
            Review how you described your situation and the answers you chose. This is not an AI chat — template mode
            uses the fixed questionnaire your advisor published.
          </>
        ) : diagnosticAiEnabled ? (
          'Describe the problem in your own words. We will ask short guided questions until we have enough context to map your case.'
        ) : (
          'Describe the problem in your own words. Next, you will step through the fixed questionnaire from your advisor’s diagnostic template (not a free-form AI chat).'
        )}
      </p>
      {!diagnosticAiEnabled ? (
        <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground md:mt-4 md:rounded-2xl md:px-4 md:py-3">
          {activeTemplate !== null ? (
            <span>
              Template mode: <span className="font-medium text-foreground">{activeTemplate.name}</span>
              {sessionReadOnly ? ' — answers below are read-only.' : '.'}
            </span>
          ) : (
            'Template mode is active, but no usable diagnostic template is available yet.'
          )}
        </div>
      ) : null}
        <label htmlFor="diagnostic-prompt" className="mt-4 block text-sm font-medium text-foreground md:mt-6">
        Your situation
      </label>
      <textarea
        id="diagnostic-prompt"
        value={guided.initialPrompt}
        disabled={isAwaitingApi || sessionReadOnly}
        onChange={(event) => executeUpdatePrompt(event.target.value)}
        rows={4}
        placeholder='Example: "Our team keeps missing release dates and stakeholders are losing trust."'
        className={cn(
          'mt-2 w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-xs outline-none transition-colors',
          'placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
          isAwaitingApi || sessionReadOnly ? 'opacity-80' : '',
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
                disabled={isAwaitingApi || sessionReadOnly}
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
      {isAwaitingApi ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          {diagnosticAiEnabled ? 'Preparing your first questions…' : 'Preparing your first template round…'}
        </div>
      ) : sessionReadOnly ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Use the step indicators above to open saved rounds. You cannot start a new run from this booked copy.
        </p>
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
