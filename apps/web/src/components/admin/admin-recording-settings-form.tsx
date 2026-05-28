'use client';

import { Clapperboard, Mic } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import type { RecordingActiveProvider } from '@/domain/recording-types';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { AdminSettingsHint, AdminSettingsLabel } from '@/components/admin/admin-settings-hint';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyActionResult, notifyError, notifySuccess } from '@/lib/notify';

const RECORDING_SETTINGS_API_URL: string = buildApiUrl('/api/admin/recording-settings');

type SettingsPayload = {
  readonly recordingsEnabled: boolean;
  readonly recordingOptInPriceCentavos: number;
  readonly recordingOptInPriceLabel: string;
  readonly activeProvider: RecordingActiveProvider;
  readonly canStoreCredentials: boolean;
  readonly webhookDestinationUrl: string;
  readonly envFathomFallbackAvailable: boolean;
  readonly providers: readonly {
    readonly id: 'fathom';
    readonly label: string;
    readonly description: string;
    readonly configured: boolean;
    readonly credentialHint: string | null;
  }[];
};

export type AdminRecordingSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminRecordingSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminRecordingSettingsFormProps = {
  readonly formRef?: Ref<AdminRecordingSettingsFormHandle>;
  readonly onStateChange?: (state: AdminRecordingSettingsFormState) => void;
};

function SettingsCard(props: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {props.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
          <div className="mt-6">{props.children}</div>
        </div>
      </div>
    </section>
  );
}

function pesosToCentavosInput(pesos: string): number {
  const parsed = Number.parseFloat(pesos.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function centavosToPesosInput(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function AdminRecordingSettingsForm(props: AdminRecordingSettingsFormProps): ReactElement {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [optInPricePesos, setOptInPricePesos] = useState<string>('0.00');
  const [fathomDraft, setFathomDraft] = useState<Record<string, string>>({});
  const [clearFathom, setClearFathom] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const isDirty =
    settings !== null &&
    savedSnapshot !== null &&
    (settings.recordingsEnabled !== savedSnapshot.recordingsEnabled ||
      settings.activeProvider !== savedSnapshot.activeProvider ||
      optInPricePesos !== centavosToPesosInput(savedSnapshot.recordingOptInPriceCentavos) ||
      Object.values(fathomDraft).some((value) => value.trim().length > 0) ||
      clearFathom);
  useEffect(() => {
    onStateChangeRef.current?.({ isDirty, isSaving, isLoading });
  }, [isDirty, isSaving, isLoading]);
  useEffect(() => {
    let cancelled = false;
    void fetch(RECORDING_SETTINGS_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load recording settings');
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setSavedSnapshot(data);
          setOptInPricePesos(centavosToPesosInput(data.recordingOptInPriceCentavos));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          notifyError(error instanceof Error ? error.message : 'Failed to load recording settings.');
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
    if (settings === null) {
      return;
    }
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        recordingsEnabled: settings.recordingsEnabled,
        recordingOptInPriceCentavos: pesosToCentavosInput(optInPricePesos),
        activeProvider: settings.recordingsEnabled ? settings.activeProvider : 'none',
      };
      if (clearFathom) {
        body.providerCredentials = { fathom: null };
      } else if (Object.values(fathomDraft).some((value) => value.trim().length > 0)) {
        body.providerCredentials = { fathom: fathomDraft };
      }
      const response = await fetch(RECORDING_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      setSettings(data);
      setSavedSnapshot(data);
      setOptInPricePesos(centavosToPesosInput(data.recordingOptInPriceCentavos));
      setFathomDraft({});
      setClearFathom(false);
      notifySuccess('Recording settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [clearFathom, fathomDraft, optInPricePesos, settings]);
  const executeTestFathom = useCallback(async (): Promise<void> => {
    setIsTesting(true);
    try {
      const response = await fetch(RECORDING_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testFathom: true }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      notifyActionResult(
        data.ok === true,
        data.message ?? 'Fathom API connection succeeded.',
        data.error ?? data.message ?? 'Fathom API test failed.',
      );
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Test failed.');
    } finally {
      setIsTesting(false);
    }
  }, []);
  useImperativeHandle(
    props.formRef,
    () => ({
      save: executeSave,
      reset: () => {
        if (savedSnapshot === null) {
          return;
        }
        setSettings(savedSnapshot);
        setOptInPricePesos(centavosToPesosInput(savedSnapshot.recordingOptInPriceCentavos));
        setFathomDraft({});
        setClearFathom(false);
      },
    }),
    [executeSave, savedSnapshot],
  );
  if (isLoading || settings === null) {
    return <AdminFormLoadingPanel label="Loading recording settings…" />;
  }
  const fathomRow = settings.providers.find((row) => row.id === 'fathom');
  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<Clapperboard className="size-5" aria-hidden />}
        title="Consultation recordings"
        description="When enabled, customers can opt in at checkout for AI meeting notes (Fathom). Set the surcharge for that opt-in."
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
          <input
            type="checkbox"
            checked={settings.recordingsEnabled}
            onChange={(event) => {
              const enabled = event.target.checked;
              setSettings((previous) =>
                previous === null
                  ? previous
                  : {
                      ...previous,
                      recordingsEnabled: enabled,
                      activeProvider: enabled && previous.activeProvider === 'none' ? 'fathom' : previous.activeProvider,
                    },
              );
            }}
            className="mt-1"
          />
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">Enable consultation recordings</span>
            <AdminSettingsHint>
              Shows an opt-in checkbox during booking checkout. Webhooks and customer note emails run only for opted-in
              bookings.
            </AdminSettingsHint>
          </span>
        </label>
        <div className="mt-4 max-w-xs space-y-2">
          <AdminSettingsLabel
            htmlFor="recording-opt-in-price"
            hint="Added to the consultation price when the customer opts in. Use 0 for free opt-in."
          >
            Opt-in price (PHP)
          </AdminSettingsLabel>
          <Input
            id="recording-opt-in-price"
            type="number"
            min={0}
            step={0.01}
            value={optInPricePesos}
            onChange={(event) => setOptInPricePesos(event.target.value)}
            disabled={!settings.recordingsEnabled}
          />
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<Mic className="size-5" aria-hidden />}
        title="Fathom"
        description="AI notetaker for Zoom, Google Meet, and Microsoft Teams. Connect your host account in Fathom, then store API credentials here."
      >
        {!settings.canStoreCredentials ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Set <code className="font-mono text-xs">MEETINGS_CREDENTIALS_MASTER_KEY</code> (min 32 characters) to save
            credentials in the database.
          </p>
        ) : null}
        {settings.envFathomFallbackAvailable ? (
          <p className="text-sm text-muted-foreground">
            Environment fallback: <code className="font-mono text-xs">FATHOM_API_KEY</code>,{' '}
            <code className="font-mono text-xs">FATHOM_WEBHOOK_SECRET</code>, optional{' '}
            <code className="font-mono text-xs">FATHOM_HOST_EMAIL</code>
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          Webhook URL: <code className="break-all font-mono text-xs">{settings.webhookDestinationUrl}</code>
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Setup documentation</span>
          <AdminSettingsHint>
            Setup steps are documented in <span className="font-mono">docs/fathom-setup.md</span> in the repository.
          </AdminSettingsHint>
        </div>
        {fathomRow?.credentialHint !== null && fathomRow?.credentialHint !== undefined ? (
          <p className="mt-3 text-xs text-muted-foreground">Stored API key: {fathomRow.credentialHint}</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: 'apiKey', label: 'API key' },
              { key: 'webhookSecret', label: 'Webhook secret' },
              { key: 'hostEmail', label: 'Host email (for matching)' },
            ] as const
          ).map((field) => (
            <div key={field.key} className={field.key === 'hostEmail' ? 'sm:col-span-2' : undefined}>
              <label className="text-sm font-medium text-foreground" htmlFor={`fathom-${field.key}`}>
                {field.label}
              </label>
              <Input
                id={`fathom-${field.key}`}
                type={field.key === 'apiKey' || field.key === 'webhookSecret' ? 'password' : 'email'}
                autoComplete="off"
                value={fathomDraft[field.key] ?? ''}
                onChange={(event) =>
                  setFathomDraft((previous) => ({ ...previous, [field.key]: event.target.value }))
                }
                className="mt-2"
                disabled={!settings.recordingsEnabled}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isTesting} onClick={() => void executeTestFathom()}>
            {isTesting ? 'Testing…' : 'Test Fathom API'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!settings.canStoreCredentials}
            onClick={() => {
              setClearFathom(true);
              setFathomDraft({});
            }}
          >
            Clear stored credentials
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
