'use client';

import { CreditCard, ShieldCheck, Wallet } from 'lucide-react';
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
import { PAYMENT_POLICIES, type PaymentGatewayId, type PaymentPolicy } from '@/domain/payment-types';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { AdminSettingsHint, AdminSettingsLabel, AdminSettingsOptionTitle } from '@/components/admin/admin-settings-hint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAdminPrimaryActionButtonClass } from '@/components/admin/admin-settings-action-button-classes';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyActionResult, notifyError, notifySuccess } from '@/lib/notify';

const PAYMENT_SETTINGS_API_URL: string = buildApiUrl('/api/admin/payment-settings');

type GatewayRow = {
  readonly id: PaymentGatewayId;
  readonly label: string;
  readonly description: string;
  readonly methodLabels: readonly string[];
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

type SettingsPayload = {
  readonly paymentsEnabled: boolean;
  readonly paymentPolicy: PaymentPolicy;
  readonly checkoutAmountCentavos: number;
  readonly holdExpiresMinutes: number;
  readonly sandboxMode: boolean;
  readonly canStoreCredentials: boolean;
  readonly gateways: readonly GatewayRow[];
};

export type AdminPaymentSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminPaymentSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminPaymentSettingsFormProps = {
  readonly formRef?: Ref<AdminPaymentSettingsFormHandle>;
  readonly onStateChange?: (state: AdminPaymentSettingsFormState) => void;
};

const GATEWAY_CREDENTIAL_FIELDS: Record<PaymentGatewayId, readonly { readonly key: string; readonly label: string }[]> = {
  paymongo: [
    { key: 'secretKey', label: 'Secret key' },
    { key: 'secretKeyTest', label: 'Test secret key (optional)' },
    { key: 'webhookSecret', label: 'Webhook secret' },
  ],
  xendit: [
    { key: 'secretKey', label: 'Secret API key' },
    { key: 'webhookToken', label: 'Webhook callback token' },
  ],
  hitpay: [
    { key: 'apiKey', label: 'API key' },
    { key: 'apiKeyTest', label: 'Test API key (optional)' },
    { key: 'salt', label: 'Salt / webhook secret' },
  ],
  paypal: [
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client secret' },
  ],
};

const POLICY_LABELS: Record<PaymentPolicy, { readonly title: string; readonly description: string }> = {
  pay_before_booking: {
    title: 'Pay before booking',
    description: 'The slot is confirmed only after successful payment.',
  },
  pay_after_hold: {
    title: 'Reserve then pay',
    description: 'Hold the slot while the customer completes payment within the hold window.',
  },
  manual_confirm: {
    title: 'Manual confirmation',
    description: 'Create a pending booking; mark paid in admin after bank transfer or offline payment.',
  },
};

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

function arePaymentSettingsEqual(
  left: SettingsPayload,
  right: SettingsPayload,
  credentialDrafts: Partial<Record<PaymentGatewayId, Record<string, string>>>,
): boolean {
  const hasCredentialDrafts = Object.values(credentialDrafts).some((draft) =>
    draft !== undefined && Object.values(draft).some((value) => value.trim().length > 0),
  );
  if (hasCredentialDrafts) {
    return false;
  }
  if (
    left.paymentsEnabled !== right.paymentsEnabled ||
    left.paymentPolicy !== right.paymentPolicy ||
    left.checkoutAmountCentavos !== right.checkoutAmountCentavos ||
    left.holdExpiresMinutes !== right.holdExpiresMinutes ||
    left.sandboxMode !== right.sandboxMode
  ) {
    return false;
  }
  return left.gateways.every((gateway, index) => {
    const other = right.gateways[index];
    return other !== undefined && gateway.id === other.id && gateway.enabled === other.enabled;
  });
}

export function AdminPaymentSettingsForm(props: AdminPaymentSettingsFormProps): ReactElement {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [credentialDrafts, setCredentialDrafts] = useState<Partial<Record<PaymentGatewayId, Record<string, string>>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testingGatewayId, setTestingGatewayId] = useState<PaymentGatewayId | null>(null);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const isDirty =
    settings !== null &&
    savedSnapshot !== null &&
    !arePaymentSettingsEqual(settings, savedSnapshot, credentialDrafts);
  useEffect(() => {
    let cancelled = false;
    void fetch(PAYMENT_SETTINGS_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load payment settings');
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
          notifyError(error instanceof Error ? error.message : 'Failed to load payment settings.');
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
      const response = await fetch(PAYMENT_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentsEnabled: settings.paymentsEnabled,
          paymentPolicy: settings.paymentPolicy,
          checkoutAmountCentavos: settings.checkoutAmountCentavos,
          holdExpiresMinutes: settings.holdExpiresMinutes,
          sandboxMode: settings.sandboxMode,
          enabledGateways: Object.fromEntries(settings.gateways.map((gateway) => [gateway.id, gateway.enabled])),
          gatewayCredentials: credentialDrafts,
        }),
      });
      const data = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      setSettings(data);
      setSavedSnapshot(data);
      setCredentialDrafts({});
      notifySuccess('Payment settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [credentialDrafts, settings]);
  const executeReset = useCallback((): void => {
    if (savedSnapshot === null) {
      return;
    }
    setSettings(savedSnapshot);
    setCredentialDrafts({});
  }, [savedSnapshot]);
  const executeTestGateway = useCallback(async (gatewayId: PaymentGatewayId): Promise<void> => {
    setTestingGatewayId(gatewayId);
    try {
      const response = await fetch(PAYMENT_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testGatewayId: gatewayId }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Test failed');
      }
      notifyActionResult(
        data.ok === true,
        data.message ?? 'Connection OK.',
        data.message ?? 'Connection failed.',
      );
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Test failed.');
    } finally {
      setTestingGatewayId(null);
    }
  }, []);
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
    return <AdminFormLoadingPanel label="Loading payment settings" variant="providers" />;
  }
  const checkoutAmountPesos = (settings.checkoutAmountCentavos / 100).toFixed(2);
  return (
    <div className="space-y-6">
      {!settings.canStoreCredentials ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Set <code className="font-mono text-xs">PAYMENT_CREDENTIALS_MASTER_KEY</code> (min 32 characters) on the server
          before saving gateway API keys.
        </p>
      ) : null}
      <SettingsCard
        icon={<Wallet className="size-5" aria-hidden />}
        title="Checkout"
        description="Control whether customers pay online, how much they pay, and when bookings are confirmed."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
            <input
              id="paymentsEnabled"
              type="checkbox"
              checked={settings.paymentsEnabled}
              onChange={(event) => {
                setSettings({ ...settings, paymentsEnabled: event.target.checked });
              }}
              className="mt-1 size-4 rounded border-input"
            />
            <div>
              <AdminSettingsLabel
                htmlFor="paymentsEnabled"
                hint="When off, checkout uses the legacy mock flow (no gateway charge)."
              >
                Enable online payments
              </AdminSettingsLabel>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
            <input
              id="sandboxMode"
              type="checkbox"
              checked={settings.sandboxMode}
              onChange={(event) => {
                setSettings({ ...settings, sandboxMode: event.target.checked });
              }}
              className="mt-1 size-4 rounded border-input"
            />
            <div>
              <AdminSettingsLabel
                htmlFor="sandboxMode"
                hint="Use test keys where providers support separate test credentials."
              >
                Sandbox mode
              </AdminSettingsLabel>
            </div>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <AdminSettingsLabel
              htmlFor="checkoutAmountPesos"
              hint="Used when no enabled catalog price matches the booking service. Per-service prices are configured in Settings → Pricing."
            >
              Fallback checkout amount (PHP)
            </AdminSettingsLabel>
            <Input
              id="checkoutAmountPesos"
              type="number"
              min={1}
              step={0.01}
              value={checkoutAmountPesos}
              onChange={(event) => {
                const pesos = Number.parseFloat(event.target.value);
                setSettings({
                  ...settings,
                  checkoutAmountCentavos: Number.isFinite(pesos) ? Math.round(pesos * 100) : settings.checkoutAmountCentavos,
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel
              htmlFor="holdExpiresMinutes"
              hint={
                settings.paymentPolicy === 'pay_after_hold'
                  ? 'Customers must complete payment within this window after the slot is held.'
                  : 'Used when extending payment deadlines on overdue bookings. For Reserve then pay, this is the hold window before the slot is released.'
              }
            >
              Payment expiry (minutes)
            </AdminSettingsLabel>
            <Input
              id="holdExpiresMinutes"
              type="number"
              min={5}
              max={1440}
              value={settings.holdExpiresMinutes}
              onChange={(event) => {
                setSettings({
                  ...settings,
                  holdExpiresMinutes: Number.parseInt(event.target.value, 10) || settings.holdExpiresMinutes,
                });
              }}
            />
          </div>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Payment timing</legend>
          <div className="grid gap-3 lg:grid-cols-3">
            {PAYMENT_POLICIES.map((policy: PaymentPolicy) => {
              const meta = POLICY_LABELS[policy]!;
              return (
                <label
                  key={policy}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 has-checked:border-primary/50 has-checked:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="paymentPolicy"
                    checked={settings.paymentPolicy === policy}
                    onChange={() => {
                      setSettings({ ...settings, paymentPolicy: policy });
                    }}
                    className="mt-1"
                  />
                  <div>
                    <AdminSettingsOptionTitle hint={meta.description}>{meta.title}</AdminSettingsOptionTitle>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      </SettingsCard>
      <SettingsCard
        icon={<CreditCard className="size-5" aria-hidden />}
        title="Payment gateways"
        description="Enable one or more providers for checkout, then enter API keys below. Webhook URLs: /api/webhooks/paymongo, xendit, hitpay, paypal."
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Enabled gateways</legend>
          <div className="grid gap-3 lg:grid-cols-2">
            {settings.gateways.map((gateway) => (
              <label
                key={gateway.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 has-checked:border-primary/50 has-checked:bg-primary/5"
              >
                <input
                  type="checkbox"
                  checked={gateway.enabled}
                  onChange={(event) => {
                    setSettings({
                      ...settings,
                      gateways: settings.gateways.map((row) =>
                        row.id === gateway.id ? { ...row, enabled: event.target.checked } : row,
                      ),
                    });
                  }}
                  className="mt-1 size-4 rounded border-input"
                />
                <div>
                  <AdminSettingsOptionTitle hint={gateway.description}>{gateway.label}</AdminSettingsOptionTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{gateway.methodLabels.join(' · ')}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-6">
          <p className="text-sm font-medium text-foreground">Gateway credentials</p>
          {settings.gateways.map((gateway) => {
            const fields = GATEWAY_CREDENTIAL_FIELDS[gateway.id] ?? [];
            const draft = credentialDrafts[gateway.id] ?? {};
            return (
              <div key={gateway.id} className="space-y-4 rounded-2xl border border-border bg-background p-4">
                <div className="space-y-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{gateway.label}</p>
                      <AdminSettingsHint>{gateway.description}</AdminSettingsHint>
                    </div>
                    {gateway.configured && gateway.credentialHint !== null ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Stored credentials: <span className="font-mono text-foreground">{gateway.credentialHint}</span>
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className={getAdminPrimaryActionButtonClass('w-full sm:w-33')}
                    disabled={testingGatewayId === gateway.id}
                    onClick={() => void executeTestGateway(gateway.id)}
                  >
                    {testingGatewayId === gateway.id ? 'Testing…' : 'Test connection'}
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-2 sm:col-span-2 lg:col-span-1">
                      <label className="text-sm font-medium text-foreground" htmlFor={`${gateway.id}-${field.key}`}>
                        {field.label}
                      </label>
                      <Input
                        id={`${gateway.id}-${field.key}`}
                        type="password"
                        autoComplete="off"
                        placeholder={gateway.configured ? 'Leave blank to keep existing' : ''}
                        value={draft[field.key] ?? ''}
                        onChange={(event) => {
                          setCredentialDrafts({
                            ...credentialDrafts,
                            [gateway.id]: { ...draft, [field.key]: event.target.value },
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<ShieldCheck className="size-5" aria-hidden />}
        title="Security note"
        description="Gateway credentials are encrypted at rest. Never share API keys in support channels or commit them to version control."
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Rotate keys in your provider dashboard if you suspect exposure, then update them here and run Test connection
          for each gateway.
        </p>
      </SettingsCard>
    </div>
  );
}
