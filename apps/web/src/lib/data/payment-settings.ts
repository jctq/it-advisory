import { COLLECTIONS } from '@/domain/collections';
import {
  PAYMENT_GATEWAY_IDS,
  PAYMENT_GATEWAY_METHOD_CATALOG,
  PAYMENT_GATEWAY_PUBLIC_CONFIGS,
  PAYMENT_POLICIES,
  type EncryptedCredentialBlob,
  type PaymentGatewayId,
  type PaymentPolicy,
  type PaymentSettingsDocument,
} from '@/domain/payment-types';
import {
  canEncryptPaymentCredentials,
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  maskCredentialHint,
} from '@/lib/server/payment-credentials-crypto';
import { getDb } from '@/lib/mongodb';
import type { GatewayCredentials } from '@techmd/payments';

export const PAYMENT_SETTINGS_DOCUMENT_ID = 'default';

const DEFAULT_CHECKOUT_AMOUNT_CENTAVOS = 600_000;

export type PaymentSettingsValues = {
  readonly paymentsEnabled: boolean;
  readonly paymentPolicy: PaymentPolicy;
  readonly currency: 'PHP';
  readonly checkoutAmountCentavos: number;
  readonly holdExpiresMinutes: number;
  readonly sandboxMode: boolean;
  readonly enabledGateways: Record<PaymentGatewayId, boolean>;
};

export type PaymentGatewayAdminStatus = {
  readonly id: PaymentGatewayId;
  readonly label: string;
  readonly description: string;
  readonly methodLabels: readonly string[];
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

export type PaymentSettingsAdminView = PaymentSettingsValues & {
  readonly canStoreCredentials: boolean;
  readonly gateways: readonly PaymentGatewayAdminStatus[];
};

export type PaymentSettingsPublicView = {
  readonly paymentsEnabled: boolean;
  readonly paymentPolicy: PaymentPolicy;
  readonly currency: 'PHP';
  readonly checkoutAmountCentavos: number;
  readonly checkoutAmountLabel: string;
  readonly holdExpiresMinutes: number;
  readonly sandboxMode: boolean;
  readonly gateways: readonly {
    readonly id: PaymentGatewayId;
    readonly label: string;
    readonly description: string;
    readonly methodLabels: readonly string[];
    readonly methods: readonly {
      readonly id: string;
      readonly label: string;
      readonly hint: string;
    }[];
  }[];
};

function defaultEnabledGateways(): Record<PaymentGatewayId, boolean> {
  return {
    paymongo: false,
    xendit: false,
    hitpay: false,
    paypal: false,
  };
}

function defaultSettings(): PaymentSettingsValues {
  return {
    paymentsEnabled: false,
    paymentPolicy: 'pay_before_booking',
    currency: 'PHP',
    checkoutAmountCentavos: DEFAULT_CHECKOUT_AMOUNT_CENTAVOS,
    holdExpiresMinutes: 30,
    sandboxMode: true,
    enabledGateways: defaultEnabledGateways(),
  };
}

function clampAmountCentavos(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CHECKOUT_AMOUNT_CENTAVOS;
  }
  const rounded = Math.round(value);
  if (rounded < 100) {
    return 100;
  }
  if (rounded > 100_000_000) {
    return 100_000_000;
  }
  return rounded;
}

function clampHoldMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 30;
  }
  const rounded = Math.round(value);
  if (rounded < 5) {
    return 5;
  }
  if (rounded > 24 * 60) {
    return 24 * 60;
  }
  return rounded;
}

function mergeEnabledGateways(
  partial: Partial<Record<PaymentGatewayId, boolean>> | undefined,
): Record<PaymentGatewayId, boolean> {
  const base = defaultEnabledGateways();
  if (partial === undefined) {
    return base;
  }
  const next = { ...base };
  for (const gatewayId of PAYMENT_GATEWAY_IDS) {
    if (typeof partial[gatewayId] === 'boolean') {
      next[gatewayId] = partial[gatewayId]!;
    }
  }
  return next;
}

function mergeDocument(doc: PaymentSettingsDocument | null): PaymentSettingsValues {
  const base = defaultSettings();
  if (doc === null) {
    return base;
  }
  const policy = PAYMENT_POLICIES.includes(doc.paymentPolicy) ? doc.paymentPolicy : base.paymentPolicy;
  return {
    paymentsEnabled: typeof doc.paymentsEnabled === 'boolean' ? doc.paymentsEnabled : base.paymentsEnabled,
    paymentPolicy: policy,
    currency: 'PHP',
    checkoutAmountCentavos: clampAmountCentavos(doc.checkoutAmountCentavos),
    holdExpiresMinutes: clampHoldMinutes(doc.holdExpiresMinutes),
    sandboxMode: typeof doc.sandboxMode === 'boolean' ? doc.sandboxMode : base.sandboxMode,
    enabledGateways: mergeEnabledGateways(doc.enabledGateways),
  };
}

function formatCheckoutAmountLabel(amountCentavos: number): string {
  const pesos = amountCentavos / 100;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(pesos);
}

export async function getPaymentSettings(): Promise<PaymentSettingsValues> {
  if (!process.env.MONGODB_URI) {
    return defaultSettings();
  }
  const db = await getDb();
  const doc = await db
    .collection<PaymentSettingsDocument>(COLLECTIONS.paymentSettings)
    .findOne({ _id: PAYMENT_SETTINGS_DOCUMENT_ID });
  return mergeDocument(doc);
}

async function loadCredentialsDocument(): Promise<Partial<Record<PaymentGatewayId, EncryptedCredentialBlob>>> {
  if (!process.env.MONGODB_URI) {
    return {};
  }
  const db = await getDb();
  const doc = await db
    .collection<PaymentSettingsDocument>(COLLECTIONS.paymentSettings)
    .findOne({ _id: PAYMENT_SETTINGS_DOCUMENT_ID });
  return doc?.gatewayCredentials ?? {};
}

export async function getGatewayCredentials(gatewayId: PaymentGatewayId): Promise<GatewayCredentials | null> {
  const blobs = await loadCredentialsDocument();
  const blob = blobs[gatewayId];
  if (blob === undefined) {
    return null;
  }
  try {
    return decryptPaymentCredentials(blob);
  } catch {
    return null;
  }
}

export async function getPaymentSettingsAdminView(): Promise<PaymentSettingsAdminView> {
  const settings = await getPaymentSettings();
  const blobs = await loadCredentialsDocument();
  const gateways: PaymentGatewayAdminStatus[] = PAYMENT_GATEWAY_PUBLIC_CONFIGS.map((config: (typeof PAYMENT_GATEWAY_PUBLIC_CONFIGS)[number]) => {
    const blob = blobs[config.id];
    let configured = false;
    let credentialHint: string | null = null;
    if (blob !== undefined) {
      try {
        const plain = decryptPaymentCredentials(blob);
        configured = Object.values(plain).some(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        );
        credentialHint = maskCredentialHint(plain);
      } catch {
        configured = false;
      }
    }
    return {
      id: config.id,
      label: config.label,
      description: config.description,
      methodLabels: config.methodLabels,
      enabled: settings.enabledGateways[config.id],
      configured,
      credentialHint,
    };
  });
  return {
    ...settings,
    canStoreCredentials: canEncryptPaymentCredentials(),
    gateways,
  };
}

export async function getPaymentSettingsPublicView(): Promise<PaymentSettingsPublicView> {
  const settings = await getPaymentSettings();
  const adminGateways = await getPaymentSettingsAdminView();
  const gateways = adminGateways.gateways
    .filter((gateway) => gateway.enabled && gateway.configured)
    .map((gateway) => ({
      id: gateway.id,
      label: gateway.label,
      description: gateway.description,
      methodLabels: gateway.methodLabels,
      methods: [...PAYMENT_GATEWAY_METHOD_CATALOG[gateway.id]],
    }));
  return {
    paymentsEnabled: settings.paymentsEnabled,
    paymentPolicy: settings.paymentPolicy,
    currency: settings.currency,
    checkoutAmountCentavos: settings.checkoutAmountCentavos,
    checkoutAmountLabel: formatCheckoutAmountLabel(settings.checkoutAmountCentavos),
    holdExpiresMinutes: settings.holdExpiresMinutes,
    sandboxMode: settings.sandboxMode,
    gateways,
  };
}

export type UpdatePaymentSettingsPatch = Partial<{
  paymentsEnabled: boolean;
  paymentPolicy: PaymentPolicy;
  checkoutAmountCentavos: number;
  holdExpiresMinutes: number;
  sandboxMode: boolean;
  enabledGateways: Partial<Record<PaymentGatewayId, boolean>>;
  gatewayCredentials: Partial<Record<PaymentGatewayId, Record<string, string> | null>>;
}>;

export async function updatePaymentSettings(patch: UpdatePaymentSettingsPatch): Promise<PaymentSettingsAdminView> {
  const current = await getPaymentSettings();
  const blobs = await loadCredentialsDocument();
  const next: PaymentSettingsValues = {
    paymentsEnabled: patch.paymentsEnabled !== undefined ? patch.paymentsEnabled : current.paymentsEnabled,
    paymentPolicy:
      patch.paymentPolicy !== undefined && PAYMENT_POLICIES.includes(patch.paymentPolicy)
        ? patch.paymentPolicy
        : current.paymentPolicy,
    currency: 'PHP',
    checkoutAmountCentavos:
      patch.checkoutAmountCentavos !== undefined
        ? clampAmountCentavos(patch.checkoutAmountCentavos)
        : current.checkoutAmountCentavos,
    holdExpiresMinutes:
      patch.holdExpiresMinutes !== undefined ? clampHoldMinutes(patch.holdExpiresMinutes) : current.holdExpiresMinutes,
    sandboxMode: patch.sandboxMode !== undefined ? patch.sandboxMode : current.sandboxMode,
    enabledGateways:
      patch.enabledGateways !== undefined
        ? mergeEnabledGateways({ ...current.enabledGateways, ...patch.enabledGateways })
        : current.enabledGateways,
  };
  const nextBlobs: Partial<Record<PaymentGatewayId, EncryptedCredentialBlob>> = { ...blobs };
  if (patch.gatewayCredentials !== undefined) {
    for (const gatewayId of PAYMENT_GATEWAY_IDS) {
      const incoming = patch.gatewayCredentials[gatewayId];
      if (incoming === undefined) {
        continue;
      }
      if (incoming === null) {
        delete nextBlobs[gatewayId];
        continue;
      }
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          filtered[key] = value.trim();
        }
      }
      if (Object.keys(filtered).length === 0) {
        delete nextBlobs[gatewayId];
        continue;
      }
      nextBlobs[gatewayId] = encryptPaymentCredentials(filtered);
    }
  }
  if (!process.env.MONGODB_URI) {
    return getPaymentSettingsAdminView();
  }
  const db = await getDb();
  const row: PaymentSettingsDocument = {
    _id: PAYMENT_SETTINGS_DOCUMENT_ID,
    ...next,
    gatewayCredentials: nextBlobs,
    updatedAt: new Date(),
  };
  await db.collection<PaymentSettingsDocument>(COLLECTIONS.paymentSettings).replaceOne({ _id: PAYMENT_SETTINGS_DOCUMENT_ID }, row, {
    upsert: true,
  });
  return getPaymentSettingsAdminView();
}

export function formatPaymentAmountLabel(amountCentavos: number): string {
  return formatCheckoutAmountLabel(amountCentavos);
}
