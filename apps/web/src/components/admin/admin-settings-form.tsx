'use client';

import { BrainCircuit, Bug, CalendarDays, LayoutTemplate } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';
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
  readonly diagnosticManageBookingEnabled: boolean;
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

export type AdminSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminSettingsFormProps = {
  readonly formRef?: Ref<AdminSettingsFormHandle>;
  readonly onStateChange?: (state: AdminSettingsFormState) => void;
};

function areSettingsEqual(left: SettingsPayload, right: SettingsPayload): boolean {
  return (
    left.diagnosticAiEnabled === right.diagnosticAiEnabled &&
    left.diagnosticManageBookingEnabled === right.diagnosticManageBookingEnabled &&
    left.diagnosticMaxRounds === right.diagnosticMaxRounds &&
    left.diagnosticQuestionsPerRound === right.diagnosticQuestionsPerRound &&
    left.diagnosticOptionsPerQuestion === right.diagnosticOptionsPerQuestion &&
    left.diagnosticCacheDebugEnabled === right.diagnosticCacheDebugEnabled
  );
}

function SettingsCard(props: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly className?: string;
}): ReactElement {
  return (
    <section className={`space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs ${props.className ?? ''}`}>
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
          {props.icon}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{props.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

export function AdminSettingsForm(props: AdminSettingsFormProps): ReactElement {
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(false);
  const [diagnosticManageBookingEnabled, setDiagnosticManageBookingEnabled] = useState<boolean>(false);
  const [diagnosticMaxRounds, setDiagnosticMaxRounds] = useState<number>(4);
  const [diagnosticQuestionsPerRound, setDiagnosticQuestionsPerRound] = useState<number>(5);
  const [diagnosticOptionsPerQuestion, setDiagnosticOptionsPerQuestion] = useState<number>(4);
  const [diagnosticCacheDebugEnabled, setDiagnosticCacheDebugEnabled] = useState<boolean>(false);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const currentPayload: SettingsPayload = useMemo(
    () => ({
      diagnosticAiEnabled,
      diagnosticManageBookingEnabled,
      diagnosticMaxRounds,
      diagnosticQuestionsPerRound,
      diagnosticOptionsPerQuestion,
      diagnosticCacheDebugEnabled,
    }),
    [
      diagnosticAiEnabled,
      diagnosticManageBookingEnabled,
      diagnosticCacheDebugEnabled,
      diagnosticMaxRounds,
      diagnosticOptionsPerQuestion,
      diagnosticQuestionsPerRound,
    ],
  );
  const isDirty = savedSnapshot !== null && !areSettingsEqual(currentPayload, savedSnapshot);
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
          const snapshot: SettingsPayload = {
            diagnosticAiEnabled: typeof data.diagnosticAiEnabled === 'boolean' ? data.diagnosticAiEnabled : false,
            diagnosticManageBookingEnabled:
              typeof data.diagnosticManageBookingEnabled === 'boolean' ? data.diagnosticManageBookingEnabled : false,
            diagnosticMaxRounds: data.diagnosticMaxRounds,
            diagnosticQuestionsPerRound: data.diagnosticQuestionsPerRound,
            diagnosticOptionsPerQuestion:
              typeof data.diagnosticOptionsPerQuestion === 'number' ? data.diagnosticOptionsPerQuestion : 4,
            diagnosticCacheDebugEnabled: data.diagnosticCacheDebugEnabled,
          };
          setDiagnosticAiEnabled(snapshot.diagnosticAiEnabled);
          setDiagnosticManageBookingEnabled(snapshot.diagnosticManageBookingEnabled);
          setDiagnosticMaxRounds(snapshot.diagnosticMaxRounds);
          setDiagnosticQuestionsPerRound(snapshot.diagnosticQuestionsPerRound);
          setDiagnosticOptionsPerQuestion(snapshot.diagnosticOptionsPerQuestion);
          setDiagnosticCacheDebugEnabled(snapshot.diagnosticCacheDebugEnabled);
          setSavedSnapshot(snapshot);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          notifyError(error instanceof Error ? error.message : 'Failed to load settings.');
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
    setIsSaving(true);
    try {
      const response = await fetch(ADMIN_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload),
      });
      const data = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      const snapshot: SettingsPayload = {
        diagnosticAiEnabled: data.diagnosticAiEnabled,
        diagnosticManageBookingEnabled: data.diagnosticManageBookingEnabled,
        diagnosticMaxRounds: data.diagnosticMaxRounds,
        diagnosticQuestionsPerRound: data.diagnosticQuestionsPerRound,
        diagnosticOptionsPerQuestion: data.diagnosticOptionsPerQuestion,
        diagnosticCacheDebugEnabled: data.diagnosticCacheDebugEnabled,
      };
      setDiagnosticAiEnabled(snapshot.diagnosticAiEnabled);
      setDiagnosticManageBookingEnabled(snapshot.diagnosticManageBookingEnabled);
      setDiagnosticMaxRounds(snapshot.diagnosticMaxRounds);
      setDiagnosticQuestionsPerRound(snapshot.diagnosticQuestionsPerRound);
      setDiagnosticOptionsPerQuestion(snapshot.diagnosticOptionsPerQuestion);
      setDiagnosticCacheDebugEnabled(snapshot.diagnosticCacheDebugEnabled);
      setSavedSnapshot(snapshot);
      notifySuccess('Diagnostic settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [currentPayload]);
  const executeReset = useCallback((): void => {
    if (savedSnapshot === null) {
      return;
    }
    setDiagnosticAiEnabled(savedSnapshot.diagnosticAiEnabled);
    setDiagnosticManageBookingEnabled(savedSnapshot.diagnosticManageBookingEnabled);
    setDiagnosticMaxRounds(savedSnapshot.diagnosticMaxRounds);
    setDiagnosticQuestionsPerRound(savedSnapshot.diagnosticQuestionsPerRound);
    setDiagnosticOptionsPerQuestion(savedSnapshot.diagnosticOptionsPerQuestion);
    setDiagnosticCacheDebugEnabled(savedSnapshot.diagnosticCacheDebugEnabled);
  }, [savedSnapshot]);
  useImperativeHandle(
    props.formRef,
    () => ({
      save: executeSave,
      reset: executeReset,
    }),
    [executeReset, executeSave],
  );
  useEffect(() => {
    onStateChangeRef.current?.({
      isDirty,
      isSaving,
      isLoading,
    });
  }, [isDirty, isLoading, isSaving]);
  const disableAiNumericFields = isLoading || !diagnosticAiEnabled;
  if (isLoading) {
    return <AdminFormLoadingPanel label="Loading diagnostic settings" variant="cards" />;
  }
  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<LayoutTemplate className="size-5" aria-hidden />}
        title="Intake mode"
        description="Choose whether customers follow a fixed template or AI-generated follow-up questions on web and native."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="diagnosticAiEnabled"
            type="checkbox"
            checked={diagnosticAiEnabled}
            onChange={(event) => {
              setDiagnosticAiEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <label htmlFor="diagnosticAiEnabled" className="text-sm font-medium text-foreground">
              AI diagnostic
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              When enabled, the quiz generates question blocks with AI. When disabled, customers use the active
              diagnostic template from Templates.
            </p>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<CalendarDays className="size-5" aria-hidden />}
        title="Manage booking"
        description="Control whether guests can open the manage-booking page, look up reservations, and pay outstanding balances."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="diagnosticManageBookingEnabled"
            type="checkbox"
            checked={diagnosticManageBookingEnabled}
            onChange={(event) => {
              setDiagnosticManageBookingEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <label htmlFor="diagnosticManageBookingEnabled" className="text-sm font-medium text-foreground">
              Enable manage booking
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              When disabled, the manage-booking page returns 404, navigation links are hidden, and manage-booking APIs
              reject requests.
            </p>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<BrainCircuit className="size-5" aria-hidden />}
        title="AI generation limits"
        description="These values apply only while AI diagnostic is enabled. Defaults: 4 rounds, 5 questions per round, 4 options per question."
        className={diagnosticAiEnabled ? undefined : 'opacity-80'}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <label htmlFor="diagnosticMaxRounds" className="text-sm font-medium text-foreground">
              Maximum rounds
            </label>
            <p className="text-xs text-muted-foreground">
              Completion required after this many rounds ({DIAGNOSTIC_MAX_ROUNDS_MIN}–{DIAGNOSTIC_MAX_ROUNDS_MAX}).
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
              Range {DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN}–{DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX}.
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
              Range {DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN}–{DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX}.
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
        </div>
        {!diagnosticAiEnabled ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Enable AI diagnostic above to edit these limits.
          </p>
        ) : null}
      </SettingsCard>
      <SettingsCard
        icon={<Bug className="size-5" aria-hidden />}
        title="Developer"
        description="Optional tooling for cache provenance and API response debugging during development."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <input
            id="diagnosticCacheDebugEnabled"
            type="checkbox"
            checked={diagnosticCacheDebugEnabled}
            onChange={(event) => {
              setDiagnosticCacheDebugEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <label htmlFor="diagnosticCacheDebugEnabled" className="text-sm font-medium text-foreground">
              Diagnostic cache debug
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Shows cache vs AI provenance on the public quiz. Successful API responses may include{' '}
              <span className="font-mono text-[11px]">_diagnosticDebug</span>; headers always include tier/source.
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
