'use client';

import { Mail } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import type { TransactionalEmailActiveProvider, TransactionalEmailProviderId } from '@/domain/email-types';
import { AdminEmailTemplatePreviewDialog } from '@/components/admin/admin-email-template-preview-dialog';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { AdminSettingsHint, AdminSettingsLabel, AdminSettingsOptionTitle } from '@/components/admin/admin-settings-hint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAdminPrimaryActionButtonClass } from '@/components/admin/admin-settings-action-button-classes';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyActionResult, notifyError, notifySuccess } from '@/lib/notify';

const EMAIL_SETTINGS_API_URL: string = buildApiUrl('/api/admin/email-settings');

type ProviderRow = {
  readonly id: TransactionalEmailProviderId;
  readonly label: string;
  readonly description: string;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

type SettingsPayload = {
  readonly activeProvider: TransactionalEmailActiveProvider;
  readonly sandboxMode: boolean;
  readonly bookingConfirmationBcc: string;
  readonly fromDisplayName: string;
  readonly defaultFromDisplayName: string;
  readonly fromEmail: string;
  readonly bookingConfirmationSubject: string;
  readonly canStoreCredentials: boolean;
  readonly providers: readonly ProviderRow[];
  readonly envResendFallbackAvailable: boolean;
};

const EMAIL_CREDENTIAL_SECRET_KEYS = new Set(['apiKey', 'serverToken']);

const CREDENTIAL_FIELDS: Record<
  TransactionalEmailProviderId,
  readonly { readonly key: string; readonly label: string; readonly autoComplete: string }[]
> = {
  resend: [
    { key: 'apiKey', label: 'API key', autoComplete: 'new-password' },
    { key: 'from', label: 'From address', autoComplete: 'off' },
  ],
  postmark: [
    { key: 'serverToken', label: 'Server API token', autoComplete: 'new-password' },
    { key: 'from', label: 'From address', autoComplete: 'off' },
  ],
  sendgrid: [
    { key: 'apiKey', label: 'API key', autoComplete: 'new-password' },
    { key: 'from', label: 'From address', autoComplete: 'off' },
  ],
};

function enableCredentialInput(event: FocusEvent<HTMLInputElement>): void {
  event.currentTarget.removeAttribute('readonly');
}

const ACTIVE_OPTIONS: readonly {
  readonly value: TransactionalEmailActiveProvider;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    value: 'none',
    title: 'None (audit / env fallback)',
    description: 'Do not use admin-stored keys. When Resend env vars are set, they are still used for sends.',
  },
  { value: 'resend', title: 'Resend', description: 'Use the Resend credentials saved below.' },
  { value: 'postmark', title: 'Postmark', description: 'Use the Postmark server token saved below.' },
  { value: 'sendgrid', title: 'SendGrid', description: 'Use the SendGrid API key saved below.' },
];

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

function areEmailSettingsEqual(
  left: SettingsPayload,
  right: SettingsPayload,
  credentialDrafts: Partial<Record<TransactionalEmailProviderId, Record<string, string>>>,
  clearFlags: Partial<Record<TransactionalEmailProviderId, boolean>>,
): boolean {
  const hasDrafts = Object.values(credentialDrafts).some(
    (draft) => draft !== undefined && Object.values(draft).some((value) => value.trim().length > 0),
  );
  if (hasDrafts) {
    return false;
  }
  if (Object.values(clearFlags).some(Boolean)) {
    return false;
  }
  if (
    left.activeProvider !== right.activeProvider ||
    left.sandboxMode !== right.sandboxMode ||
    left.bookingConfirmationBcc !== right.bookingConfirmationBcc ||
    left.fromDisplayName !== right.fromDisplayName ||
    left.fromEmail !== right.fromEmail ||
    left.bookingConfirmationSubject !== right.bookingConfirmationSubject
  ) {
    return false;
  }
  return true;
}

export type AdminEmailSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminEmailSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminEmailSettingsFormProps = {
  readonly formRef?: Ref<AdminEmailSettingsFormHandle>;
  readonly onStateChange?: (state: AdminEmailSettingsFormState) => void;
};

export function AdminEmailSettingsForm(props: AdminEmailSettingsFormProps): ReactElement {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [credentialDrafts, setCredentialDrafts] = useState<
    Partial<Record<TransactionalEmailProviderId, Record<string, string>>>
  >({});
  const [clearFlags, setClearFlags] = useState<Partial<Record<TransactionalEmailProviderId, boolean>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testingProviderId, setTestingProviderId] = useState<TransactionalEmailProviderId | null>(null);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const isDirty =
    settings !== null &&
    savedSnapshot !== null &&
    !areEmailSettingsEqual(settings, savedSnapshot, credentialDrafts, clearFlags);
  useEffect(() => {
    let cancelled = false;
    void fetch(EMAIL_SETTINGS_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load email settings');
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
          notifyError(error instanceof Error ? error.message : 'Failed to load email settings.');
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
    if (settings === null || savedSnapshot === null) {
      return;
    }
    if (areEmailSettingsEqual(settings, savedSnapshot, credentialDrafts, clearFlags)) {
      return;
    }
    setIsSaving(true);
    try {
      const providerCredentials: Partial<Record<TransactionalEmailProviderId, Record<string, string> | null>> = {};
      for (const providerId of ['resend', 'postmark', 'sendgrid'] as const) {
        if (clearFlags[providerId] === true) {
          providerCredentials[providerId] = null;
        } else {
          const draft = credentialDrafts[providerId];
          if (draft !== undefined) {
            const filledEntries = Object.entries(draft).filter(([, value]) => value.trim().length > 0);
            if (filledEntries.length > 0) {
              providerCredentials[providerId] = Object.fromEntries(
                filledEntries.map(([key, value]) => [key, value.trim()]),
              );
            }
          }
        }
      }
      const response = await fetch(EMAIL_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProvider: settings.activeProvider,
          sandboxMode: settings.sandboxMode,
          bookingConfirmationBcc: settings.bookingConfirmationBcc,
          fromDisplayName: settings.fromDisplayName,
          fromEmail: settings.fromEmail,
          bookingConfirmationSubject: settings.bookingConfirmationSubject,
          providerCredentials: Object.keys(providerCredentials).length > 0 ? providerCredentials : undefined,
        }),
      });
      const data = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      setSettings(data);
      setSavedSnapshot(data);
      setCredentialDrafts({});
      setClearFlags({});
      notifySuccess('Email settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [clearFlags, credentialDrafts, savedSnapshot, settings]);
  const executeTestProvider = useCallback(async (providerId: TransactionalEmailProviderId): Promise<void> => {
    setTestingProviderId(providerId);
    try {
      const response = await fetch(EMAIL_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testProviderId: providerId }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Test failed');
      }
      notifyActionResult(
        data.ok === true,
        data.message ?? 'Test email sent.',
        data.message ?? 'Test send failed.',
      );
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Test failed.');
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
    setClearFlags({});
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
  if (isLoading || settings === null) {
    return <AdminFormLoadingPanel label="Loading email settings" variant="providers" />;
  }
  return (
    <div className="space-y-6">
      {!settings.canStoreCredentials ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Set <code className="font-mono text-xs">EMAIL_CREDENTIALS_MASTER_KEY</code> (min 32 characters) on the server before
          saving provider API keys (separate from payment gateway encryption).
        </p>
      ) : null}
      {settings.envResendFallbackAvailable && settings.activeProvider === 'none' ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Resend is available via environment variables (<code className="font-mono text-xs">RESEND_API_KEY</code> +{' '}
          <code className="font-mono text-xs">EMAIL_FROM</code>) until you select an admin provider above.
        </p>
      ) : null}
      <SettingsCard
        icon={<Mail className="size-5" aria-hidden />}
        title="Transactional email"
        description="Choose one provider for booking confirmations. Only the active provider is used when sending."
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Active provider</legend>
          <div className="grid gap-3 lg:grid-cols-2">
            {ACTIVE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 has-checked:border-primary/50 has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="emailActiveProvider"
                  checked={settings.activeProvider === option.value}
                  onChange={() => {
                    setSettings({ ...settings, activeProvider: option.value });
                  }}
                  className="mt-1"
                />
                <div>
                  <AdminSettingsOptionTitle hint={option.description}>{option.title}</AdminSettingsOptionTitle>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="emailSandboxMode"
            type="checkbox"
            checked={settings.sandboxMode}
            onChange={(event) => {
              setSettings({ ...settings, sandboxMode: event.target.checked });
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <AdminSettingsLabel
              htmlFor="emailSandboxMode"
              hint={
                <>
                  When on, the transactional <strong>To</strong> address is replaced with a safe test inbox so messages
                  are not delivered to customers. Set <code className="font-mono text-[11px]">EMAIL_SANDBOX_TO</code> to
                  choose that inbox; if unset, the app uses its default safe address. BCC is skipped in sandbox. The
                  original recipient is still stored on <code className="font-mono text-[11px]">email_sends</code> as{' '}
                  <code className="font-mono text-[11px]">sandboxIntendedTo</code> for auditing.
                </>
              }
            >
              Sandbox mode (safe test delivery)
            </AdminSettingsLabel>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <AdminSettingsLabel
              htmlFor="transactionalFromDisplayName"
              hint={
                <>
                  Shown in the inbox as the sender. Leave blank to use{' '}
                  <strong className="font-medium text-foreground">General → Site name</strong> (
                  {settings.defaultFromDisplayName}).
                </>
              }
            >
              From display name (optional)
            </AdminSettingsLabel>
            <Input
              id="transactionalFromDisplayName"
              type="text"
              autoComplete="off"
              placeholder={settings.defaultFromDisplayName}
              value={settings.fromDisplayName}
              onChange={(event) => {
                setSettings({ ...settings, fromDisplayName: event.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel
              htmlFor="transactionalFromEmail"
              hint="When set, overrides the per-provider From address. Combined with the display name above."
            >
              From email (optional)
            </AdminSettingsLabel>
            <Input
              id="transactionalFromEmail"
              type="text"
              autoComplete="off"
              placeholder="bookings@yourdomain.com"
              value={settings.fromEmail}
              onChange={(event) => {
                setSettings({ ...settings, fromEmail: event.target.value });
              }}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AdminSettingsLabel
                htmlFor="bookingConfirmationSubject"
                hint={
                  <>
                    Use <code className="font-mono text-[11px]">{'{{bookingReference}}'}</code> for the booking reference.
                    Leave blank for the default.
                  </>
                }
              >
                Booking confirmation subject
              </AdminSettingsLabel>
              <AdminEmailTemplatePreviewDialog bookingConfirmationSubject={settings.bookingConfirmationSubject} />
            </div>
            <Input
              id="bookingConfirmationSubject"
              type="text"
              autoComplete="off"
              placeholder="Booking confirmed — {{bookingReference}}"
              value={settings.bookingConfirmationSubject}
              onChange={(event) => {
                setSettings({ ...settings, bookingConfirmationSubject: event.target.value });
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <AdminSettingsLabel
            htmlFor="bookingConfirmationBcc"
            hint="Comma-separated addresses copied on every booking confirmation send."
          >
            Booking confirmation BCC (optional)
          </AdminSettingsLabel>
          <Input
            id="bookingConfirmationBcc"
            type="text"
            autoComplete="off"
            placeholder="ops@example.com, founder@example.com"
            value={settings.bookingConfirmationBcc}
            onChange={(event) => {
              setSettings({ ...settings, bookingConfirmationBcc: event.target.value });
            }}
          />
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<Mail className="size-5" aria-hidden />}
        title="Provider credentials"
        description="Keys are encrypted at rest. Leave blanks to keep existing secrets; use Clear only when rotating or removing a provider."
      >
        <div className="space-y-6">
          {settings.providers.map((provider) => {
            const fields = CREDENTIAL_FIELDS[provider.id];
            const draft = credentialDrafts[provider.id] ?? {};
            const willClear = clearFlags[provider.id] === true;
            const canTestThisProvider: boolean =
              !willClear &&
              (provider.id === 'resend'
                ? provider.configured || settings.envResendFallbackAvailable
                : provider.configured);
            return (
              <div key={provider.id} className="space-y-4 rounded-2xl border border-border bg-background p-4">
                <div className="space-y-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                      <AdminSettingsHint>{provider.description}</AdminSettingsHint>
                    </div>
                    {provider.configured && provider.credentialHint !== null ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Stored credentials: <span className="font-mono text-foreground">{provider.credentialHint}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className={getAdminPrimaryActionButtonClass('w-full sm:min-w-36')}
                      disabled={!canTestThisProvider || testingProviderId === provider.id}
                      onClick={() => void executeTestProvider(provider.id)}
                    >
                      {testingProviderId === provider.id ? 'Sending…' : 'Send test email'}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className={getAdminPrimaryActionButtonClass('w-full sm:min-w-44')}
                      disabled={!provider.configured && !willClear}
                      onClick={() => {
                        setClearFlags((prev) => ({ ...prev, [provider.id]: !willClear }));
                        setCredentialDrafts((prev) => {
                          const next = { ...prev };
                          delete next[provider.id];
                          return next;
                        });
                      }}
                    >
                      {willClear ? 'Undo clear' : 'Clear stored credentials'}
                    </Button>
                  </div>
                </div>
                {willClear ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Marked for removal on save.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label htmlFor={`${provider.id}-${field.key}`} className="text-sm font-medium text-foreground">
                          {field.label}
                        </label>
                        <Input
                          id={`${provider.id}-${field.key}`}
                          name={`email-credential-${provider.id}-${field.key}`}
                          type={EMAIL_CREDENTIAL_SECRET_KEYS.has(field.key) ? 'password' : 'text'}
                          autoComplete={field.autoComplete}
                          readOnly={EMAIL_CREDENTIAL_SECRET_KEYS.has(field.key)}
                          data-1p-ignore={EMAIL_CREDENTIAL_SECRET_KEYS.has(field.key) ? true : undefined}
                          data-lpignore={EMAIL_CREDENTIAL_SECRET_KEYS.has(field.key) ? 'true' : undefined}
                          data-form-type="other"
                          placeholder={
                            EMAIL_CREDENTIAL_SECRET_KEYS.has(field.key) && provider.configured
                              ? 'Leave blank to keep saved value'
                              : field.key === 'from'
                                ? 'Bookings <bookings@yourdomain.com>'
                                : ''
                          }
                          value={draft[field.key] ?? ''}
                          onFocus={EMAIL_CREDENTIAL_SECRET_KEYS.has(field.key) ? enableCredentialInput : undefined}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCredentialDrafts((prev) => ({
                              ...prev,
                              [provider.id]: { ...draft, [field.key]: value },
                            }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}
