'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PublicDiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import {
  buildActiveRoundFromTemplate,
  buildTemplateDiagnosticOutcome,
} from '@/lib/marketing/diagnostic-template-flow';
import type { DiagnosticRoundDebugMeta } from '@/domain/types';
import { extractDiagnosticRoundDebugFromResponse } from '@/lib/marketing/diagnostic-cache-debug';
import {
  type CompletedRoundBundle,
  type DiagnosticQuestionBlock,
  type GuidedDiagnosticOutcome,
  type GuidedDiagnosticV1,
  buildDiagnosticTranscript,
  formatGuidedQuestionAnswer,
  normalizeDiagnosticOptionLabels,
  toApiRoundsFromBundles,
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

export type GuidedDiagnosticWizardProps = {
  readonly guided: GuidedDiagnosticV1;
  readonly onGuidedChange: (next: GuidedDiagnosticV1) => void;
};

function buildBundleFromActive(active: GuidedDiagnosticV1['activeRound']): CompletedRoundBundle | null {
  if (active === null) {
    return null;
  }
  return {
    roundIndex: active.roundIndex,
    questions: active.questions,
    answers: { ...active.answers },
    answerNotes: { ...active.answerNotes },
    guidance: active.guidance,
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
  const { guided, onGuidedChange } = props;
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
    return buildActiveRoundFromTemplate(activeTemplate, 0);
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
    (questionId: string, option: string): void => {
      if (guided.activeRound === null) {
        return;
      }
      onGuidedChange({
        ...guided,
        activeRound: {
          ...guided.activeRound,
          answers: {
            ...guided.activeRound.answers,
            [questionId]: option,
          },
        },
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
        options: normalizeDiagnosticOptionLabels(row.options),
      }));
      onGuidedChange({
        ...guided,
        completedBundles,
        activeRound: {
          roundIndex: completedBundles.length,
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
    const activeRound = guided.activeRound;
    const currentQuestion = activeRound.questions[activeRound.stepIndex];
    if (currentQuestion === undefined) {
      return;
    }
    const selectedOption = activeRound.answers[currentQuestion.id] ?? '';
    const detailNote = activeRound.answerNotes[currentQuestion.id] ?? '';
    const combined = formatGuidedQuestionAnswer(selectedOption, detailNote);
    if (combined === '') {
      setErrorMessage('Pick an option above or type your exact answer below.');
      return;
    }
    if (activeRound.stepIndex < activeRound.questions.length - 1) {
      onGuidedChange({
        ...guided,
        activeRound: {
          ...activeRound,
          stepIndex: activeRound.stepIndex + 1,
        },
      });
      return;
    }
    const bundle = buildBundleFromActive(activeRound);
    if (bundle === null) {
      return;
    }
    const nextCompleted = [...guided.completedBundles, bundle];
    if (!diagnosticAiEnabled) {
      if (activeTemplate === null) {
        setErrorMessage('AI Diagnostic is off, but no active template is ready yet.');
        return;
      }
      const nextRound = buildActiveRoundFromTemplate(activeTemplate, nextCompleted.length);
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
    const activeRound = guided.activeRound;
    const question = activeRound.questions[activeRound.stepIndex];
    const selected =
      question !== undefined ? (activeRound.answers[question.id] ?? undefined) : undefined;
    const questionOptions = question !== undefined ? normalizeDiagnosticOptionLabels(question.options) : [];
    const showGuidance = activeRound.stepIndex === 0 && activeRound.guidance !== null && activeRound.guidance.length > 0;
    const positionInRound = activeRound.stepIndex + 1;
    const roundSize = activeRound.questions.length;
    return (
      <div>
        <DiagnosticCacheDebugPanel
          showDebugUi={cacheDebugUiEnabled}
          entries={diagnosticDebugLog}
          onClear={() => setDiagnosticDebugLog([])}
        />
        <p className="mt-2 text-pretty text-muted-foreground">
          Answer one question at a time—tap an option, type your exact answer, or both. Your progress is saved—refresh
          or use Back and you will return to the same step.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Question {positionInRound} of {roundSize} · Round {activeRound.roundIndex + 1}
        </p>
        {showGuidance ? (
          <p className="mt-4 text-sm font-medium text-foreground">{activeRound.guidance}</p>
        ) : null}
        {question !== undefined ? (
          <fieldset className="mt-8 space-y-4">
            <legend className="text-lg font-medium text-foreground">{question.prompt}</legend>
            <div className="grid gap-3 sm:grid-cols-2" role="group">
              {questionOptions.map((option) => {
                const isSelected = selected === option;
                return (
                  <button
                    key={`${question.id}-${option}`}
                    type="button"
                    onClick={() => executeSelectOption(question.id, option)}
                    className={cn(
                      'flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30'
                        : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              <label
                htmlFor={`diagnostic-exact-answer-${question.id}`}
                className="text-sm font-medium text-foreground"
              >
                Your exact answer
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick an option, type here, or both. Use this for specifics the buttons do not cover (versions, errors,
                timing).
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
                {MAX_ANSWER_NOTE_LENGTH - (activeRound.answerNotes[question.id]?.length ?? 0)} characters left
              </p>
            </div>
          </fieldset>
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
          <div className="mt-8">
            <Button type="button" onClick={() => void executeAdvanceOrSubmitRound()}>
              {activeRound.stepIndex >= activeRound.questions.length - 1 ? 'Submit round' : 'Continue'}
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
