'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  applyGuidedGoBack,
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
  const labels = [...params.roundSummaries.map((round, index) => normalizeRoundLabel(round.title, index)), 'Summary', 'Recommendation'];
  const currentIndex =
    params.guided.outcome !== null
      ? params.roundSummaries.length
      : params.guided.activeRound !== null
        ? Math.max(
            0,
            params.roundSummaries.findIndex((round) => round.authoredRoundIndex === params.guided.activeRound?.roundIndex),
          )
        : 0;
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
  const executeSeeRecommendation = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await persistGuided(guided, true);
      router.push('/recommendation');
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
      <div className="mb-8 space-y-3">
        {roundProgressSteps.length > 0 && !diagnosticAiEnabled ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-xs">
            <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
              {roundProgressSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3">
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
                    <div className="mt-3 hidden h-px flex-1 bg-border md:block" aria-hidden />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
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
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        Guided diagnostic
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        Tell us what is going on in plain language, then move through short multiple-choice screens until we can map
        your situation and brief your advisor.
      </p>
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
          {guided.outcome !== null ? (
            <Button type="button" onClick={() => void executeSeeRecommendation()} disabled={isSaving}>
              Next: Recommendation
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
