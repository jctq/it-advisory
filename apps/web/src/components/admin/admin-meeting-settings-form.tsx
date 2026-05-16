'use client';

import { Video } from 'lucide-react';
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
import {
  VIDEO_MEETING_PROVIDER_IDS,
  type VideoMeetingActiveProvider,
  type VideoMeetingProviderId,
} from '@/domain/meeting-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl } from '@/lib/config/build-api-url';

const MEETING_SETTINGS_API_URL: string = buildApiUrl('/api/admin/meeting-settings');

type ProviderRow = {
  readonly id: VideoMeetingProviderId;
  readonly label: string;
  readonly description: string;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

type SettingsPayload = {
  readonly activeProvider: VideoMeetingActiveProvider;
  readonly canStoreCredentials: boolean;
  readonly providers: readonly ProviderRow[];
  readonly envZoomFallbackAvailable: boolean;
  readonly envGoogleMeetFallbackAvailable: boolean;
  readonly envMicrosoftTeamsFallbackAvailable: boolean;
};

const PROVIDER_FIELD_DEFS: Record<
  VideoMeetingProviderId,
  readonly { readonly key: string; readonly label: string; readonly autoComplete: string }[]
> = {
  zoom: [
    { key: 'accountId', label: 'Zoom account id', autoComplete: 'off' },
    { key: 'clientId', label: 'Client id', autoComplete: 'off' },
    { key: 'clientSecret', label: 'Client secret', autoComplete: 'new-password' },
    { key: 'hostUserId', label: 'Host user id or email', autoComplete: 'username' },
  ],
  googleMeet: [
    { key: 'clientId', label: 'OAuth client id', autoComplete: 'off' },
    { key: 'clientSecret', label: 'OAuth client secret', autoComplete: 'new-password' },
    { key: 'refreshToken', label: 'Refresh token (offline access)', autoComplete: 'new-password' },
    { key: 'calendarId', label: 'Calendar id (optional, default primary)', autoComplete: 'off' },
  ],
  microsoftTeams: [
    { key: 'tenantId', label: 'Directory (tenant) id', autoComplete: 'off' },
    { key: 'clientId', label: 'Application (client) id', autoComplete: 'off' },
    { key: 'clientSecret', label: 'Client secret', autoComplete: 'new-password' },
    { key: 'organizerUserId', label: 'Organizer object id or UPN', autoComplete: 'username' },
  ],
};

const PROVIDER_CARD_COPY: Record<VideoMeetingProviderId, { readonly title: string; readonly description: string }> = {
  zoom: {
    title: 'Zoom Server-to-Server OAuth',
    description:
      'Create a Server-to-Server OAuth app in the Zoom Marketplace. The host user must be licensed to create meetings.',
  },
  googleMeet: {
    title: 'Google Meet (Calendar API)',
    description:
      'Google Cloud OAuth client with Calendar API enabled. Authorize with scope https://www.googleapis.com/auth/calendar.events and offline access to obtain a refresh token for the calendar owner. Paid bookings only get Meet links when Google Meet is the selected active provider (not only when credentials are saved).',
  },
  microsoftTeams: {
    title: 'Microsoft Teams (Graph online meetings)',
    description:
      'Entra ID app registration with application permissions OnlineMeetings.ReadWrite.All (and User.Read.All for the connection test). Admin consent required. Meetings are created for the organizer user below. Paid bookings only get Teams links when Microsoft Teams is the selected active provider.',
  },
};

const ACTIVE_OPTIONS: readonly {
  readonly value: VideoMeetingActiveProvider;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    value: 'none',
    title: 'None (environment fallbacks only)',
    description:
      'When none is selected, only Zoom credentials from environment variables are used for meetings (legacy). Google Meet and Microsoft Teams require selecting them here or saving admin keys while active.',
  },
  {
    value: 'zoom',
    title: 'Zoom',
    description: 'Use Zoom Server-to-Server OAuth credentials saved below, or ZOOM_* environment variables as fallback.',
  },
  {
    value: 'googleMeet',
    title: 'Google Meet',
    description: 'Use Google OAuth credentials saved below, or GOOGLE_MEET_* environment variables as fallback.',
  },
  {
    value: 'microsoftTeams',
    title: 'Microsoft Teams',
    description: 'Use Azure app credentials saved below, or MICROSOFT_TEAMS_* environment variables as fallback.',
  },
];

function hasCredentialDrafts(drafts: Partial<Record<VideoMeetingProviderId, Record<string, string>>>): boolean {
  for (const id of VIDEO_MEETING_PROVIDER_IDS) {
    const draft = drafts[id];
    if (draft !== undefined && Object.values(draft).some((value) => typeof value === 'string' && value.trim().length > 0)) {
      return true;
    }
  }
  return false;
}

function hasAnyClearProvider(clear: Partial<Record<VideoMeetingProviderId, boolean>>): boolean {
  for (const id of VIDEO_MEETING_PROVIDER_IDS) {
    if (clear[id] === true) {
      return true;
    }
  }
  return false;
}

function areMeetingSettingsEqual(
  left: SettingsPayload,
  right: SettingsPayload,
  credentialDrafts: Partial<Record<VideoMeetingProviderId, Record<string, string>>>,
  clearProviders: Partial<Record<VideoMeetingProviderId, boolean>>,
): boolean {
  if (hasCredentialDrafts(credentialDrafts)) {
    return false;
  }
  if (hasAnyClearProvider(clearProviders)) {
    return false;
  }
  return left.activeProvider === right.activeProvider;
}

function SettingsCard(props: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
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

export type AdminMeetingSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
  readonly statusMessage: string | null;
  readonly errorMessage: string | null;
};

export type AdminMeetingSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminMeetingSettingsFormProps = {
  readonly formRef?: Ref<AdminMeetingSettingsFormHandle>;
  readonly onStateChange?: (state: AdminMeetingSettingsFormState) => void;
};

export function AdminMeetingSettingsForm(props: AdminMeetingSettingsFormProps): ReactElement {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [credentialDrafts, setCredentialDrafts] = useState<
    Partial<Record<VideoMeetingProviderId, Record<string, string>>>
  >({});
  const [clearProviders, setClearProviders] = useState<Partial<Record<VideoMeetingProviderId, boolean>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testingProviderId, setTestingProviderId] = useState<VideoMeetingProviderId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const isDirty =
    settings !== null &&
    savedSnapshot !== null &&
    !areMeetingSettingsEqual(settings, savedSnapshot, credentialDrafts, clearProviders);
  useEffect(() => {
    let cancelled = false;
    void fetch(MEETING_SETTINGS_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load meeting settings');
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setSavedSnapshot(data);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load meeting settings.');
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
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const providerCredentials: Partial<Record<VideoMeetingProviderId, Record<string, string> | null>> = {};
      for (const id of VIDEO_MEETING_PROVIDER_IDS) {
        if (clearProviders[id] === true) {
          providerCredentials[id] = null;
        } else {
          const draft = credentialDrafts[id];
          if (draft !== undefined && Object.values(draft).some((v) => v.trim().length > 0)) {
            providerCredentials[id] = draft;
          }
        }
      }
      const body: {
        activeProvider: VideoMeetingActiveProvider;
        providerCredentials?: Partial<Record<VideoMeetingProviderId, Record<string, string> | null>>;
      } = {
        activeProvider: settings.activeProvider,
      };
      if (Object.keys(providerCredentials).length > 0) {
        body.providerCredentials = providerCredentials;
      }
      const response = await fetch(MEETING_SETTINGS_API_URL, {
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
      setCredentialDrafts({});
      setClearProviders({});
      setStatusMessage('Meeting settings saved.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [clearProviders, credentialDrafts, settings]);
  const executeTestProvider = useCallback(async (providerId: VideoMeetingProviderId): Promise<void> => {
    setTestingProviderId(providerId);
    setErrorMessage(null);
    try {
      const response = await fetch(MEETING_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testProviderId: providerId }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Test failed');
      }
      setStatusMessage(data.message ?? (data.ok ? 'Connection OK.' : 'Test failed.'));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Test failed.');
    } finally {
      setTestingProviderId(null);
    }
  }, []);
  const executeReset = useCallback((): void => {
    if (savedSnapshot === null) {
      return;
    }
    setSettings(savedSnapshot);
    setCredentialDrafts({});
    setClearProviders({});
    setStatusMessage(null);
    setErrorMessage(null);
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
      statusMessage,
      errorMessage,
    });
  }, [errorMessage, isDirty, isLoading, isSaving, statusMessage]);
  if (isLoading || settings === null) {
    return <p className="text-sm text-muted-foreground">Loading meeting settings…</p>;
  }
  return (
    <div className="space-y-6">
      {errorMessage !== null ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!settings.canStoreCredentials ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Set <code className="font-mono text-xs">MEETINGS_CREDENTIALS_MASTER_KEY</code> (min 32 characters) on the server before
          saving meeting provider credentials (separate from payment and email encryption keys).
        </p>
      ) : null}
      {settings.activeProvider === 'none' ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Environment fallbacks when provider is None</p>
          {settings.envZoomFallbackAvailable ? (
            <p>
              Zoom: <code className="font-mono text-xs">ZOOM_ACCOUNT_ID</code>, <code className="font-mono text-xs">ZOOM_CLIENT_ID</code>,{' '}
              <code className="font-mono text-xs">ZOOM_CLIENT_SECRET</code>, <code className="font-mono text-xs">ZOOM_HOST_USER_ID</code>
            </p>
          ) : (
            <p>Zoom: no ZOOM_* variables detected.</p>
          )}
          {settings.envGoogleMeetFallbackAvailable ? (
            <p>
              Google Meet: <code className="font-mono text-xs">GOOGLE_MEET_CLIENT_ID</code>,{' '}
              <code className="font-mono text-xs">GOOGLE_MEET_CLIENT_SECRET</code>,{' '}
              <code className="font-mono text-xs">GOOGLE_MEET_REFRESH_TOKEN</code> (optional{' '}
              <code className="font-mono text-xs">GOOGLE_MEET_CALENDAR_ID</code>)
            </p>
          ) : (
            <p>Google Meet: no GOOGLE_MEET_* variables detected.</p>
          )}
          {settings.envMicrosoftTeamsFallbackAvailable ? (
            <p>
              Microsoft Teams: <code className="font-mono text-xs">MICROSOFT_TEAMS_TENANT_ID</code>,{' '}
              <code className="font-mono text-xs">MICROSOFT_TEAMS_CLIENT_ID</code>,{' '}
              <code className="font-mono text-xs">MICROSOFT_TEAMS_CLIENT_SECRET</code>,{' '}
              <code className="font-mono text-xs">MICROSOFT_TEAMS_ORGANIZER_USER_ID</code>
            </p>
          ) : (
            <p>Microsoft Teams: no MICROSOFT_TEAMS_* variables detected.</p>
          )}
        </div>
      ) : null}
      <SettingsCard
        icon={<Video className="size-5" aria-hidden />}
        title="Video meetings"
        description="Choose how confirmed bookings get a join URL. Only the active provider is used when creating meetings."
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Active provider</legend>
          <div className="space-y-2">
            {ACTIVE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 hover:border-primary/30"
              >
                <input
                  type="radio"
                  name="meeting-active-provider"
                  checked={settings.activeProvider === option.value}
                  onChange={() => {
                    setSettings((previous) =>
                      previous === null ? previous : { ...previous, activeProvider: option.value },
                    );
                  }}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">{option.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </SettingsCard>
      {VIDEO_MEETING_PROVIDER_IDS.map((providerId) => {
        const row = settings.providers.find((p) => p.id === providerId);
        if (row === undefined) {
          return null;
        }
        const copy = PROVIDER_CARD_COPY[providerId];
        const fields = PROVIDER_FIELD_DEFS[providerId];
        const secretKeys = new Set(['clientSecret', 'refreshToken']);
        return (
          <SettingsCard
            key={providerId}
            icon={<Video className="size-5" aria-hidden />}
            title={copy.title}
            description={copy.description}
          >
            <div className="space-y-3">
              {row.configured && row.credentialHint !== null ? (
                <p className="text-xs text-muted-foreground">
                  Saved credential hint: <span className="font-mono">{row.credentialHint}</span>
                </p>
              ) : null}
              {fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label
                    htmlFor={`${providerId}-${field.key}`}
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {field.label}
                  </Label>
                  <Input
                    id={`${providerId}-${field.key}`}
                    name={`${providerId}-${field.key}`}
                    autoComplete={field.autoComplete}
                    type={secretKeys.has(field.key) ? 'password' : 'text'}
                    placeholder={
                      secretKeys.has(field.key) && row.configured ? 'Leave blank to keep saved value' : field.key === 'calendarId' ? 'primary' : ''
                    }
                    value={credentialDrafts[providerId]?.[field.key] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCredentialDrafts((previous) => ({
                        ...previous,
                        [providerId]: { ...previous[providerId], [field.key]: value },
                      }));
                    }}
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={testingProviderId !== null}
                  onClick={() => void executeTestProvider(providerId)}
                >
                  {testingProviderId === providerId ? 'Testing…' : `Test ${row.label} connection`}
                </Button>
                {row.configured ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setClearProviders((previous) => ({ ...previous, [providerId]: true }));
                      setCredentialDrafts((previous) => ({ ...previous, [providerId]: {} }));
                    }}
                  >
                    Clear saved {row.label} keys
                  </Button>
                ) : null}
              </div>
            </div>
          </SettingsCard>
        );
      })}
    </div>
  );
}
