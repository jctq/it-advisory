'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  applyGuidedGoBack,
  applyGuidedJumpToCompletedBundleIndex,
  buildDiagnosticAnswerLookup,
  buildDiagnosticThreadJson,
  computeGuidedLinearStep,
  findPreviousVisibleQuestionIndex,
  parseGuidedDiagnosticJson,
  serializeGuidedDiagnostic,
  type GuidedDiagnosticV1,
} from '@/lib/marketing/guided-diagnostic-types';
import type { PublicDiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { listVisibleTemplateRoundSummaries } from '@/lib/marketing/diagnostic-template-flow';
import { cn } from '@/lib/utils';
import { GuidedDiagnosticWizard } from './guided-diagnostic-wizard';

const QUIZ_SESSION_API_URL = '/api/quiz/session';
const DIAGNOSTIC_CONFIG_API_URL = '/api/quiz/diagnostic-config';
const DIAGNOSTIC_TEMPLATE_API_URL = '/api/quiz/diagnostic-template';
/** Matches `SiteHeader` (`h-16`) so quiz progress sticks below the marketing nav instead of under it. */
const MARKETING_SITE_HEADER_HEIGHT_PX = 64;

type DiagnosticPublicConfig = {
  readonly diagnosticAiEnabled: boolean;
};

type DiagnosticTemplateApiBody = {
  readonly template: PublicDiagnosticTemplateValue | null;
};

type DiagnosticProgressStep = {
  readonly id: string;
  readonly label: string;
  readonly status: 'complete' | 'current' | 'upcoming';
};

function normalizeRoundLabel(rawLabel: string, index: number): string {
  const trimmedLabel = rawLabel.trim();
  return trimmedLabel.length > 0 ? trimmedLabel : `Round ${index + 1}`;
}

function buildPreviousRoundLabel(guided: GuidedDiagnosticV1): string | null {
  if (guided.outcome !== null) {
    const lastCompletedBundle = guided.completedBundles[guided.completedBundles.length - 1];
    return lastCompletedBundle?.roundTitle ?? null;
  }
  if (guided.activeRound === null) {
    return null;
  }
  const previousVisibleQuestionIndex = findPreviousVisibleQuestionIndex({
    questions: guided.activeRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: guided.completedBundles,
    }),
    answers: guided.activeRound.answers,
    currentIndex: guided.activeRound.stepIndex,
  });
  if (previousVisibleQuestionIndex !== null) {
    return null;
  }
  const previousCompletedBundle = guided.completedBundles[guided.completedBundles.length - 1];
  return previousCompletedBundle?.roundTitle ?? null;
}

type CurrentRoundProgressSummary = {
  readonly currentStepNumber: number;
  readonly totalStepCount: number;
  readonly currentStepLabel: string;
};

function summarizeCurrentRoundProgress(
  steps: readonly DiagnosticProgressStep[],
): CurrentRoundProgressSummary | null {
  if (steps.length === 0) {
    return null;
  }
  const currentIndex = steps.findIndex((step) => step.status === 'current');
  const completedCount = steps.filter((step) => step.status === 'complete').length;
  const resolvedIndex = currentIndex >= 0 ? currentIndex : Math.min(completedCount, steps.length - 1);
  const resolvedStep = steps[resolvedIndex];
  if (resolvedStep === undefined) {
    return null;
  }
  return {
    currentStepNumber: resolvedIndex + 1,
    totalStepCount: steps.length,
    currentStepLabel: resolvedStep.label,
  };
}

function computeRoundProgressCurrentIndex(params: {
  readonly guided: GuidedDiagnosticV1;
  readonly roundSummaries: readonly {
    readonly authoredRoundIndex: number;
    readonly id: string;
    readonly title: string;
  }[];
}): number {
  if (params.roundSummaries.length === 0) {
    return 0;
  }
  if (params.guided.outcome !== null) {
    return params.roundSummaries.length;
  }
  if (params.guided.activeRound !== null) {
    return Math.max(
      0,
      params.roundSummaries.findIndex((round) => round.authoredRoundIndex === params.guided.activeRound?.roundIndex),
    );
  }
  return 0;
}

function buildRoundProgressSteps(params: {
  readonly guided: GuidedDiagnosticV1;
  readonly roundSummaries: readonly {
    readonly authoredRoundIndex: number;
    readonly id: string;
    readonly title: string;
  }[];
}): readonly DiagnosticProgressStep[] {
  if (params.roundSummaries.length === 0) {
    return [];
  }
  const labels = [...params.roundSummaries.map((round, index) => normalizeRoundLabel(round.title, index)), 'Recommendation'];
  const currentIndex = computeRoundProgressCurrentIndex({
    guided: params.guided,
    roundSummaries: params.roundSummaries,
  });
  return labels.map((label, index) => ({
    id: `${index}-${label}`,
    label,
    status: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
  }));
}

function buildAnswersPayload(guided: GuidedDiagnosticV1): Record<string, string | number | boolean | string[]> {
  return {
    guidedDiagnostic: serializeGuidedDiagnostic(guided),
    situation: guided.outcome?.mappedSituation ?? '',
    situationAdvisorSummary: guided.outcome?.advisorSummary ?? '',
    situationDiagnosticThread: buildDiagnosticThreadJson(guided),
  };
}

/**
 * Mongo may return guidedDiagnostic as a string or as a nested document depending on how it was stored.
 */
function normalizeGuidedDiagnosticRaw(raw: unknown): string | undefined {
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

export function QuizFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [guided, setGuided] = useState<GuidedDiagnosticV1>(GUIDED_DIAGNOSTIC_EMPTY);
  const [isSessionReady, setIsSessionReady] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(true);
  const [activeTemplate, setActiveTemplate] = useState<PublicDiagnosticTemplateValue | null>(null);
  const [isWizardProgressPinned, setIsWizardProgressPinned] = useState<boolean>(false);
  const wizardProgressStickySentinelRef = useRef<HTMLDivElement | null>(null);
  const hasHydratedRef = useRef<boolean>(false);
  const persistGuided = useCallback(async (next: GuidedDiagnosticV1, completed: boolean): Promise<void> => {
    const linearStep = computeGuidedLinearStep(next);
    await fetch(QUIZ_SESSION_API_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: buildAnswersPayload(next),
        currentStep: linearStep,
        completed,
      }),
    });
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function initializeSession(): Promise<void> {
      if (searchParams.get('retake') === '1') {
        await persistGuided(GUIDED_DIAGNOSTIC_EMPTY, false);
        if (cancelled) {
          return;
        }
        setGuided(GUIDED_DIAGNOSTIC_EMPTY);
        hasHydratedRef.current = true;
        setIsSessionReady(true);
        router.replace('/quiz');
        return;
      }
      try {
        const response = await fetch(QUIZ_SESSION_API_URL);
        if (!response.ok || cancelled) {
          return;
        }
        const data = (await response.json()) as {
          session: { answers: Record<string, string | string[] | number | boolean>; currentStep: number } | null;
        };
        if (cancelled || !data.session) {
          return;
        }
        const rawGuided = data.session.answers['guidedDiagnostic'];
        const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
        const parsed =
          normalized !== undefined && normalized !== '' ? parseGuidedDiagnosticJson(normalized) : null;
        setGuided(parsed ?? GUIDED_DIAGNOSTIC_EMPTY);
      } finally {
        if (!cancelled) {
          hasHydratedRef.current = true;
          setIsSessionReady(true);
        }
      }
    }
    void initializeSession();
    return () => {
      cancelled = true;
    };
  }, [persistGuided, router, searchParams]);
  useEffect(() => {
    let cancelled = false;
    async function loadProgressMetadata(): Promise<void> {
      try {
        const configResponse = await fetch(DIAGNOSTIC_CONFIG_API_URL);
        const configData = (await configResponse.json()) as DiagnosticPublicConfig;
        if (cancelled) {
          return;
        }
        const nextDiagnosticAiEnabled =
          typeof configData.diagnosticAiEnabled === 'boolean' ? configData.diagnosticAiEnabled : true;
        setDiagnosticAiEnabled(nextDiagnosticAiEnabled);
        if (nextDiagnosticAiEnabled) {
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
          setDiagnosticAiEnabled(true);
          setActiveTemplate(null);
        }
      }
    }
    void loadProgressMetadata();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!isSessionReady) {
      return;
    }
    const sentinel = wizardProgressStickySentinelRef.current;
    if (sentinel === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry === undefined) {
          return;
        }
        setIsWizardProgressPinned(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: `-${MARKETING_SITE_HEADER_HEIGHT_PX}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [isSessionReady]);
  useEffect(() => {
    if (!isSessionReady || !hasHydratedRef.current) {
      return;
    }
    const handle = setTimeout(() => {
      void persistGuided(guided, false);
    }, 280);
    return () => clearTimeout(handle);
  }, [guided, isSessionReady, persistGuided]);
  useEffect(() => {
    if (!isSessionReady || typeof document === 'undefined') {
      return;
    }
    function flushBeforeLeave(): void {
      void persistGuided(guided, false);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushBeforeLeave();
      }
    });
    window.addEventListener('pagehide', flushBeforeLeave);
    return () => {
      document.removeEventListener('visibilitychange', flushBeforeLeave);
      window.removeEventListener('pagehide', flushBeforeLeave);
    };
  }, [guided, isSessionReady, persistGuided]);
  const progressPercent = useMemo(() => {
    if (guided.outcome !== null) {
      return 100;
    }
    const linear = computeGuidedLinearStep(guided);
    return Math.min(94, 6 + linear * 9);
  }, [guided]);
  const visibleTemplateRounds = useMemo(
    () =>
      activeTemplate === null
        ? []
        : listVisibleTemplateRoundSummaries({
            template: activeTemplate,
            completedBundles: guided.completedBundles,
            activeRound: guided.activeRound,
          }),
    [activeTemplate, guided.activeRound, guided.completedBundles],
  );
  const progressHint = useMemo(() => {
    if (guided.outcome !== null) {
      return 'Summary';
    }
    if (guided.activeRound !== null) {
      return `Question ${computeGuidedLinearStep(guided)}`;
    }
    return 'Describe';
  }, [guided]);
  const roundProgressSteps = useMemo(
    () => buildRoundProgressSteps({ guided, roundSummaries: visibleTemplateRounds }),
    [guided, visibleTemplateRounds],
  );
  const currentRoundProgressSummary = useMemo(
    () => summarizeCurrentRoundProgress(roundProgressSteps),
    [roundProgressSteps],
  );
  const canGoBack = computeGuidedLinearStep(guided) > 1;
  const previousRoundLabel = useMemo(() => buildPreviousRoundLabel(guided), [guided]);
  const backLabel: string = previousRoundLabel !== null ? `Back: ${previousRoundLabel}` : 'Back';
  const showRetakeLink =
    guided.outcome !== null ||
    guided.completedBundles.length > 0 ||
    guided.activeRound !== null ||
    guided.initialPrompt.trim().length > 0;
  const executeGoBack = (): void => {
    setGuided((previous) => applyGuidedGoBack(previous));
  };
  const executeJumpToRoundProgressStep = useCallback(
    (targetRoundStepIndex: number) => {
      if (diagnosticAiEnabled || visibleTemplateRounds.length === 0) {
        return;
      }
      const currentProgressIndex = computeRoundProgressCurrentIndex({
        guided,
        roundSummaries: visibleTemplateRounds,
      });
      if (targetRoundStepIndex >= currentProgressIndex || targetRoundStepIndex >= visibleTemplateRounds.length) {
        return;
      }
      const roundSummary = visibleTemplateRounds[targetRoundStepIndex];
      if (roundSummary === undefined) {
        return;
      }
      const bundleIndex = guided.completedBundles.findIndex((bundle) => bundle.roundIndex === roundSummary.authoredRoundIndex);
      if (bundleIndex < 0) {
        return;
      }
      const nextGuided = applyGuidedJumpToCompletedBundleIndex(guided, bundleIndex);
      if (nextGuided === null) {
        return;
      }
      setGuided(nextGuided);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [diagnosticAiEnabled, guided, visibleTemplateRounds],
  );
  const executeContinueToService = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await persistGuided(guided, true);
      router.push('/service');
    } finally {
      setIsSaving(false);
    }
  };
  if (!isSessionReady) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="h-2 animate-pulse rounded-full bg-muted" aria-hidden />
        <div className="mt-10 h-8 max-w-md animate-pulse rounded-md bg-muted" aria-hidden />
        <div className="mt-4 h-4 max-w-lg animate-pulse rounded-md bg-muted/70" aria-hidden />
        <p className="sr-only">Loading your diagnostic progress</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div ref={wizardProgressStickySentinelRef} className="hidden h-px w-full shrink-0 lg:block" aria-hidden />
      <div
        className={cn(
          'mb-8 space-y-3 transition-[box-shadow,background-color,border-color] duration-200 lg:sticky lg:top-16 lg:z-40 lg:-mx-6 lg:border-b lg:px-6 lg:py-4 lg:backdrop-blur',
          isWizardProgressPinned
            ? 'lg:border-border lg:bg-background lg:shadow-md lg:supports-backdrop-filter:bg-background/92'
            : 'lg:border-transparent lg:bg-background/85 lg:supports-backdrop-filter:bg-background/70',
        )}
      >
        {roundProgressSteps.length > 0 && !diagnosticAiEnabled ? (
          <>
            {currentRoundProgressSummary !== null ? (
              <div
                className="flex flex-col gap-2 lg:hidden"
                role="group"
                aria-label={`Template progress: step ${currentRoundProgressSummary.currentStepNumber} of ${currentRoundProgressSummary.totalStepCount}, ${currentRoundProgressSummary.currentStepLabel}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {currentRoundProgressSummary.currentStepNumber} of {currentRoundProgressSummary.totalStepCount}
                  </p>
                  <p className="min-w-0 truncate text-right text-sm font-semibold text-foreground">
                    {currentRoundProgressSummary.currentStepLabel}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {roundProgressSteps.map((step, stepIndex) => {
                    const barClassName = cn(
                      'h-1.5 w-full rounded-full transition-colors',
                      step.status === 'complete'
                        ? 'bg-primary'
                        : step.status === 'current'
                          ? 'bg-primary/60'
                          : 'bg-muted',
                    );
                    const isJumpTarget =
                      stepIndex < visibleTemplateRounds.length && step.status === 'complete';
                    if (!isJumpTarget) {
                      return (
                        <div key={step.id} className="flex min-h-11 min-w-0 flex-1 items-center px-0.5">
                          <span className={barClassName} aria-hidden />
                        </div>
                      );
                    }
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className="flex min-h-11 min-w-0 flex-1 items-center rounded-md px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        onClick={() => executeJumpToRoundProgressStep(stepIndex)}
                        aria-label={`Go to ${step.label}`}
                      >
                        <span className={barClassName} aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="hidden rounded-2xl border border-border bg-card px-4 py-4 shadow-xs lg:block">
              <div className="grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
                {roundProgressSteps.map((step, index) => {
                  const isJumpTarget = index < visibleTemplateRounds.length && step.status === 'complete';
                  const rowInner = (
                    <>
                      <div className="flex flex-1 items-center gap-3">
                        <span
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                            step.status === 'complete'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : step.status === 'current'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground',
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'truncate text-xs font-semibold uppercase tracking-wide',
                              step.status === 'current' ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {step.label}
                          </p>
                        </div>
                      </div>
                      {index < roundProgressSteps.length - 1 ? (
                        <div className="mt-3 hidden h-px flex-1 bg-border lg:block" aria-hidden />
                      ) : null}
                    </>
                  );
                  const rowClassName = 'flex min-h-11 w-full min-w-0 items-start gap-3';
                  if (isJumpTarget) {
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className={cn(
                          rowClassName,
                          'rounded-xl px-1 py-0.5 text-left transition-colors',
                          'hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
                        )}
                        onClick={() => executeJumpToRoundProgressStep(index)}
                        aria-label={`Go to ${step.label}`}
                      >
                        {rowInner}
                      </button>
                    );
                  }
                  return (
                    <div key={step.id} className={rowClassName}>
                      {rowInner}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>{progressHint}</span>
              <span>{progressPercent}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </div>
      {guided.outcome === null && guided.activeRound?.roundIndex === 0 ? (
        <>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Guided diagnostic
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            Tell us what is going on in plain language, then move through short multiple-choice screens until we can map
            your situation and brief your advisor.
          </p>
        </>
      ) : null}
      <GuidedDiagnosticWizard
        backLabel={backLabel}
        canGoBack={canGoBack}
        guided={guided}
        onGoBack={executeGoBack}
        onGuidedChange={setGuided}
      />
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" asChild>
          <Link href="/" className="gap-1">
            <ChevronLeft className="size-4" aria-hidden />
            Home
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showRetakeLink ? (
            <Button type="button" variant="outline" asChild>
              <Link href="/quiz?retake=1">Retake diagnostic</Link>
            </Button>
          ) : null}
          {canGoBack && guided.activeRound === null ? (
            <Button type="button" variant="outline" onClick={executeGoBack}>
              {backLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
