'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  DIAGNOSTIC_MAX_ROUNDS_MAX,
  DIAGNOSTIC_MAX_ROUNDS_MIN,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
} from '@/domain/diagnostic-settings-bounds';

type SettingsPayload = {
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

export function AdminSettingsForm(): ReactElement {
  const [diagnosticMaxRounds, setDiagnosticMaxRounds] = useState<number>(4);
  const [diagnosticQuestionsPerRound, setDiagnosticQuestionsPerRound] = useState<number>(5);
  const [diagnosticOptionsPerQuestion, setDiagnosticOptionsPerQuestion] = useState<number>(4);
  const [diagnosticCacheDebugEnabled, setDiagnosticCacheDebugEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/settings')
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load settings');
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setDiagnosticMaxRounds(data.diagnosticMaxRounds);
          setDiagnosticQuestionsPerRound(data.diagnosticQuestionsPerRound);
          setDiagnosticOptionsPerQuestion(
            typeof data.diagnosticOptionsPerQuestion === 'number' ? data.diagnosticOptionsPerQuestion : 4,
          );
          setDiagnosticCacheDebugEnabled(data.diagnosticCacheDebugEnabled);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load settings.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const executeSave = useCallback(async (): Promise<void> => {
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosticMaxRounds,
          diagnosticQuestionsPerRound,
          diagnosticOptionsPerQuestion,
          diagnosticCacheDebugEnabled,
        }),
      });
      const data = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      setDiagnosticMaxRounds(data.diagnosticMaxRounds);
      setDiagnosticQuestionsPerRound(data.diagnosticQuestionsPerRound);
      setDiagnosticOptionsPerQuestion(data.diagnosticOptionsPerQuestion);
      setDiagnosticCacheDebugEnabled(data.diagnosticCacheDebugEnabled);
      setStatusMessage('Saved.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [
    diagnosticCacheDebugEnabled,
    diagnosticMaxRounds,
    diagnosticOptionsPerQuestion,
    diagnosticQuestionsPerRound,
  ]);
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Configuration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Quiz & diagnostic</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tune rounds before forced completion, how many questions appear per round, how many tap options each
            question has, and whether cache-vs-AI debug appears on the public quiz (and extra JSON on the API when
            enabled).
          </p>
          <p className="mt-3 max-w-2xl rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Defaults</span> (until you save settings): 4 rounds · 5
            questions per round · 4 options per question.
          </p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm font-medium text-primary">
          <Link href="/admin/leads" className="underline-offset-4 hover:underline">
            Leads
          </Link>
          <Link href="/admin/bookings" className="underline-offset-4 hover:underline">
            Bookings
          </Link>
          <Link href="/admin/advisor" className="underline-offset-4 hover:underline">
            Advisor
          </Link>
        </nav>
      </header>
      {errorMessage !== null && !isLoading ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <section className="max-w-xl space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-2">
          <label htmlFor="diagnosticMaxRounds" className="text-sm font-medium text-foreground">
            Maximum rounds before completion is required
          </label>
          <p className="text-xs text-muted-foreground">
            After this many completed rounds, the model must return a mapped situation and summary (range{' '}
            {DIAGNOSTIC_MAX_ROUNDS_MIN}–{DIAGNOSTIC_MAX_ROUNDS_MAX}).
          </p>
          <input
            id="diagnosticMaxRounds"
            type="number"
            min={DIAGNOSTIC_MAX_ROUNDS_MIN}
            max={DIAGNOSTIC_MAX_ROUNDS_MAX}
            disabled={isLoading}
            value={diagnosticMaxRounds}
            onChange={(event) => {
              setDiagnosticMaxRounds(Number.parseInt(event.target.value, 10) || DIAGNOSTIC_MAX_ROUNDS_MIN);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="diagnosticQuestionsPerRound" className="text-sm font-medium text-foreground">
            Questions per round
          </label>
          <p className="text-xs text-muted-foreground">
            Multiple-choice blocks per round when intake is not complete (range {DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN}–
            {DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX}).
          </p>
          <input
            id="diagnosticQuestionsPerRound"
            type="number"
            min={DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN}
            max={DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX}
            disabled={isLoading}
            value={diagnosticQuestionsPerRound}
            onChange={(event) => {
              setDiagnosticQuestionsPerRound(
                Number.parseInt(event.target.value, 10) || DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
              );
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="diagnosticOptionsPerQuestion" className="text-sm font-medium text-foreground">
            Options per question
          </label>
          <p className="text-xs text-muted-foreground">
            Each multiple-choice question exposes exactly this many tap options (range{' '}
            {DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN}–{DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX}).
          </p>
          <input
            id="diagnosticOptionsPerQuestion"
            type="number"
            min={DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN}
            max={DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX}
            disabled={isLoading}
            value={diagnosticOptionsPerQuestion}
            onChange={(event) => {
              setDiagnosticOptionsPerQuestion(
                Number.parseInt(event.target.value, 10) || DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
              );
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="flex items-start gap-3">
          <input
            id="diagnosticCacheDebugEnabled"
            type="checkbox"
            disabled={isLoading}
            checked={diagnosticCacheDebugEnabled}
            onChange={(event) => {
              setDiagnosticCacheDebugEnabled(event.target.checked);
            }}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <div>
            <label htmlFor="diagnosticCacheDebugEnabled" className="text-sm font-medium text-foreground">
              Diagnostic cache debug
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              When on, the public quiz shows cache vs AI provenance and successful API responses may include{' '}
              <span className="font-mono text-[11px]">_diagnosticDebug</span>. Response headers always include tier/source.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button type="button" disabled={isLoading || isSaving} onClick={() => void executeSave()}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          {statusMessage !== null ? <span className="text-sm text-muted-foreground">{statusMessage}</span> : null}
        </div>
      </section>
    </div>
  );
}
