'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  applyGuidedGoBack,
  buildDiagnosticThreadJson,
  computeGuidedLinearStep,
  parseGuidedDiagnosticJson,
  serializeGuidedDiagnostic,
  type GuidedDiagnosticV1,
} from '@/lib/marketing/guided-diagnostic-types';
import { GuidedDiagnosticWizard } from './guided-diagnostic-wizard';

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
  const hasHydratedRef = useRef<boolean>(false);
  const persistGuided = useCallback(async (next: GuidedDiagnosticV1, completed: boolean): Promise<void> => {
    const linearStep = computeGuidedLinearStep(next);
    await fetch('/api/quiz/session', {
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
        const response = await fetch('/api/quiz/session');
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
  const progressHint = useMemo(() => {
    if (guided.outcome !== null) {
      return 'Summary';
    }
    if (guided.activeRound !== null) {
      const prior = guided.completedBundles.reduce((acc, bundle) => acc + bundle.questions.length, 0);
      const ord = prior + guided.activeRound.stepIndex + 1;
      return `Question ${ord}`;
    }
    return 'Describe';
  }, [guided]);
  const canGoBack = computeGuidedLinearStep(guided) > 0;
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
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="h-2 animate-pulse rounded-full bg-muted" aria-hidden />
        <div className="mt-10 h-8 max-w-md animate-pulse rounded-md bg-muted" aria-hidden />
        <div className="mt-4 h-4 max-w-lg animate-pulse rounded-md bg-muted/70" aria-hidden />
        <p className="sr-only">Loading your diagnostic progress</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 space-y-3">
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
      </div>
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        Guided diagnostic
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        Tell us what is going on in plain language, then move through short multiple-choice screens until we can map
        your situation and brief your advisor.
      </p>
      <GuidedDiagnosticWizard guided={guided} onGuidedChange={setGuided} />
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
          {canGoBack ? (
            <Button type="button" variant="outline" onClick={executeGoBack}>
              Back
            </Button>
          ) : null}
          {guided.outcome !== null ? (
            <Button type="button" onClick={() => void executeSeeRecommendation()} disabled={isSaving}>
              See recommendation
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
