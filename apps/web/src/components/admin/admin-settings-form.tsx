'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import {
  DIAGNOSTIC_MAX_ROUNDS_MAX,
  DIAGNOSTIC_MAX_ROUNDS_MIN,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
} from '@/domain/diagnostic-settings-bounds';

const ADMIN_SETTINGS_API_URL: string = buildApiUrl('/api/admin/settings');

type SettingsPayload = {
  readonly diagnosticAiEnabled: boolean;
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

export function AdminSettingsForm(): ReactElement {
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(false);
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
    void fetch(ADMIN_SETTINGS_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load settings');
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setDiagnosticAiEnabled(typeof data.diagnosticAiEnabled === 'boolean' ? data.diagnosticAiEnabled : false);
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
      const response = await fetch(ADMIN_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosticAiEnabled,
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
      setDiagnosticAiEnabled(data.diagnosticAiEnabled);
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
    diagnosticAiEnabled,
    diagnosticCacheDebugEnabled,
    diagnosticMaxRounds,
    diagnosticOptionsPerQuestion,
    diagnosticQuestionsPerRound,
  ]);
  const disableAiNumericFields = isLoading || !diagnosticAiEnabled;
  return (
    <div className="space-y-6">
      {errorMessage !== null && !isLoading ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Diagnostic mode</p>
          <p className="text-sm text-muted-foreground">
            AI mode uses generated follow-up questions. Template mode uses the active admin-managed diagnostic template
            for customer-facing flows in web and native.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="diagnosticAiEnabled"
            type="checkbox"
            disabled={isLoading}
            checked={diagnosticAiEnabled}
            onChange={(event) => {
              setDiagnosticAiEnabled(event.target.checked);
            }}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <div>
            <label htmlFor="diagnosticAiEnabled" className="text-sm font-medium text-foreground">
              AI Diagnostic
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              When on, the quiz generates question blocks with AI. When off, customers follow the active diagnostic
              template configured in admin.
            </p>
          </div>
        </div>
      </section>
      <section className="max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">AI-only limits</p>
          <p className="text-sm text-muted-foreground">
            These values only apply while AI Diagnostic is on. Defaults remain 4 rounds, 5 questions per round, and 4
            options per question until you save.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="diagnosticMaxRounds" className="text-sm font-medium text-foreground">
            Maximum rounds before completion is required
          </label>
          <p className="text-xs text-muted-foreground">
            After this many completed rounds, the model must return a mapped situation and summary (range{' '}
            {DIAGNOSTIC_MAX_ROUNDS_MIN}–{DIAGNOSTIC_MAX_ROUNDS_MAX}).
          </p>
          <Input
            id="diagnosticMaxRounds"
            type="number"
            min={DIAGNOSTIC_MAX_ROUNDS_MIN}
            max={DIAGNOSTIC_MAX_ROUNDS_MAX}
            disabled={disableAiNumericFields}
            value={diagnosticMaxRounds}
            onChange={(event) => {
              setDiagnosticMaxRounds(Number.parseInt(event.target.value, 10) || DIAGNOSTIC_MAX_ROUNDS_MIN);
            }}
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
          <Input
            id="diagnosticQuestionsPerRound"
            type="number"
            min={DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN}
            max={DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX}
            disabled={disableAiNumericFields}
            value={diagnosticQuestionsPerRound}
            onChange={(event) => {
              setDiagnosticQuestionsPerRound(
                Number.parseInt(event.target.value, 10) || DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
              );
            }}
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
          <Input
            id="diagnosticOptionsPerQuestion"
            type="number"
            min={DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN}
            max={DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX}
            disabled={disableAiNumericFields}
            value={diagnosticOptionsPerQuestion}
            onChange={(event) => {
              setDiagnosticOptionsPerQuestion(
                Number.parseInt(event.target.value, 10) || DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
              );
            }}
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
