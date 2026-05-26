import { COLLECTIONS } from '@/domain/collections';
import {
  RECORDING_PROVIDER_IDS,
  type RecordingActiveProvider,
  type RecordingProviderId,
  type RecordingSettingsDocument,
} from '@/domain/recording-types';
import type { EncryptedCredentialBlob, PaymentGatewayCredentialsPlain } from '@/domain/payment-types';
import {
  canEncryptMeetingCredentials,
  decryptMeetingCredentials,
  encryptMeetingCredentials,
} from '@/lib/server/meeting-credentials-crypto';
import { maskCredentialHint } from '@/lib/server/payment-credentials-crypto';
import { getDb } from '@/lib/mongodb';
import { formatPaymentAmountLabel } from '@/lib/data/payment-settings';

export const RECORDING_SETTINGS_DOCUMENT_ID = 'default';

const DEFAULT_OPT_IN_PRICE_CENTAVOS = 0 as const;
const MIN_OPT_IN_PRICE_CENTAVOS = 0 as const;
const MAX_OPT_IN_PRICE_CENTAVOS = 100_000_000 as const;

export class RecordingSettingsCredentialValidationError extends Error {
  public override readonly name = 'RecordingSettingsCredentialValidationError';
  public constructor(message: string) {
    super(message);
  }
}

export type FathomCredentials = {
  readonly apiKey: string;
  readonly webhookSecret: string;
  readonly hostEmail: string;
};

export type RecordingProviderAdminStatus = {
  readonly id: RecordingProviderId;
  readonly label: string;
  readonly description: string;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

export type RecordingSettingsValues = {
  readonly recordingsEnabled: boolean;
  readonly recordingOptInPriceCentavos: number;
  readonly activeProvider: RecordingActiveProvider;
};

export type RecordingSettingsAdminView = RecordingSettingsValues & {
  readonly canStoreCredentials: boolean;
  readonly recordingOptInPriceLabel: string;
  readonly providers: readonly RecordingProviderAdminStatus[];
  readonly webhookDestinationUrl: string;
  readonly envFathomFallbackAvailable: boolean;
};

export type RecordingSettingsPublicView = {
  readonly recordingsEnabled: boolean;
  readonly recordingOptInPriceCentavos: number;
  readonly recordingOptInPriceLabel: string;
};

function clampOptInPriceCentavos(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_OPT_IN_PRICE_CENTAVOS;
  }
  const rounded = Math.round(value);
  if (rounded < MIN_OPT_IN_PRICE_CENTAVOS) {
    return MIN_OPT_IN_PRICE_CENTAVOS;
  }
  if (rounded > MAX_OPT_IN_PRICE_CENTAVOS) {
    return MAX_OPT_IN_PRICE_CENTAVOS;
  }
  return rounded;
}

function defaultSettings(): RecordingSettingsValues {
  return {
    recordingsEnabled: false,
    recordingOptInPriceCentavos: DEFAULT_OPT_IN_PRICE_CENTAVOS,
    activeProvider: 'none',
  };
}

function mergeDocument(doc: RecordingSettingsDocument | null): Omit<RecordingSettingsDocument, 'updatedAt'> {
  const base: Omit<RecordingSettingsDocument, 'updatedAt'> = {
    _id: RECORDING_SETTINGS_DOCUMENT_ID,
    recordingsEnabled: false,
    recordingOptInPriceCentavos: DEFAULT_OPT_IN_PRICE_CENTAVOS,
    activeProvider: 'none',
    providerCredentials: {},
  };
  if (doc === null) {
    return base;
  }
  const active: RecordingActiveProvider =
    doc.activeProvider === 'none' || RECORDING_PROVIDER_IDS.includes(doc.activeProvider as RecordingProviderId)
      ? doc.activeProvider
      : base.activeProvider;
  return {
    _id: RECORDING_SETTINGS_DOCUMENT_ID,
    recordingsEnabled: typeof doc.recordingsEnabled === 'boolean' ? doc.recordingsEnabled : base.recordingsEnabled,
    recordingOptInPriceCentavos: clampOptInPriceCentavos(doc.recordingOptInPriceCentavos),
    activeProvider: active,
    providerCredentials: doc.providerCredentials ?? {},
  };
}

async function loadDocument(): Promise<RecordingSettingsDocument | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<RecordingSettingsDocument>(COLLECTIONS.recordingSettings)
    .findOne({ _id: RECORDING_SETTINGS_DOCUMENT_ID });
}

function readFathomCredentialsFromEnv(): FathomCredentials | null {
  const apiKey = process.env.FATHOM_API_KEY?.trim() ?? '';
  const webhookSecret = process.env.FATHOM_WEBHOOK_SECRET?.trim() ?? '';
  const hostEmail = process.env.FATHOM_HOST_EMAIL?.trim() ?? '';
  if (apiKey.length === 0 || webhookSecret.length === 0) {
    return null;
  }
  return { apiKey, webhookSecret, hostEmail };
}

function envFathomFallbackAvailable(): boolean {
  return readFathomCredentialsFromEnv() !== null;
}

function extractFathomFromPlain(plain: PaymentGatewayCredentialsPlain): FathomCredentials | null {
  const apiKey = plain.apiKey?.trim() ?? '';
  const webhookSecret = plain.webhookSecret?.trim() ?? '';
  const hostEmail = plain.hostEmail?.trim() ?? '';
  if (apiKey.length === 0 || webhookSecret.length === 0) {
    return null;
  }
  return { apiKey, webhookSecret, hostEmail };
}

function tryDecryptFathomFromMerged(merged: Omit<RecordingSettingsDocument, 'updatedAt'>): FathomCredentials | null {
  const blob = merged.providerCredentials.fathom;
  if (blob === undefined) {
    return null;
  }
  try {
    return extractFathomFromPlain(decryptMeetingCredentials(blob));
  } catch {
    return null;
  }
}

function resolveWebhookDestinationUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  if (fromPublic.length > 0) {
    return `${fromPublic.replace(/\/$/, '')}/api/webhooks/fathom`;
  }
  const vercel = process.env.VERCEL_URL?.trim() ?? '';
  if (vercel.length === 0) {
    return '/api/webhooks/fathom';
  }
  const origin = vercel.startsWith('http') ? vercel.replace(/\/$/, '') : `https://${vercel.replace(/\/$/, '')}`;
  return `${origin}/api/webhooks/fathom`;
}

export async function getRecordingSettings(): Promise<RecordingSettingsValues> {
  if (!process.env.MONGODB_URI) {
    return defaultSettings();
  }
  const doc = await loadDocument();
  const merged = mergeDocument(doc);
  return {
    recordingsEnabled: merged.recordingsEnabled,
    recordingOptInPriceCentavos: merged.recordingOptInPriceCentavos,
    activeProvider: merged.activeProvider,
  };
}

export async function getRecordingSettingsPublicView(): Promise<RecordingSettingsPublicView> {
  const settings = await getRecordingSettings();
  const priceCentavos = settings.recordingsEnabled ? settings.recordingOptInPriceCentavos : 0;
  return {
    recordingsEnabled: settings.recordingsEnabled,
    recordingOptInPriceCentavos: priceCentavos,
    recordingOptInPriceLabel: formatPaymentAmountLabel(priceCentavos),
  };
}

export async function getRecordingSettingsAdminView(): Promise<RecordingSettingsAdminView> {
  const doc = await loadDocument();
  const merged = mergeDocument(doc);
  const fathomConfigured = tryDecryptFathomFromMerged(merged) !== null || readFathomCredentialsFromEnv() !== null;
  const fathomHint = tryDecryptFathomFromMerged(merged);
  const providers: RecordingProviderAdminStatus[] = [
    {
      id: 'fathom',
      label: 'Fathom',
      description: 'AI notetaker that joins video calls for transcripts, summaries, and action items.',
      configured: fathomConfigured,
      credentialHint:
        fathomHint !== null
          ? maskCredentialHint({ apiKey: fathomHint.apiKey })
          : envFathomFallbackAvailable()
            ? 'Using FATHOM_* environment variables'
            : null,
    },
  ];
  return {
    recordingsEnabled: merged.recordingsEnabled,
    recordingOptInPriceCentavos: merged.recordingOptInPriceCentavos,
    activeProvider: merged.activeProvider,
    recordingOptInPriceLabel: formatPaymentAmountLabel(merged.recordingOptInPriceCentavos),
    canStoreCredentials: canEncryptMeetingCredentials(),
    providers,
    webhookDestinationUrl: resolveWebhookDestinationUrl(),
    envFathomFallbackAvailable: envFathomFallbackAvailable(),
  };
}

export async function resolveFathomCredentialsForRuntime(): Promise<FathomCredentials | null> {
  const settings = await getRecordingSettings();
  if (!settings.recordingsEnabled || settings.activeProvider !== 'fathom') {
    return null;
  }
  const merged = mergeDocument(await loadDocument());
  const fromAdmin = tryDecryptFathomFromMerged(merged);
  if (fromAdmin !== null) {
    return fromAdmin;
  }
  return readFathomCredentialsFromEnv();
}

export type UpdateRecordingSettingsPatch = Partial<{
  recordingsEnabled: boolean;
  recordingOptInPriceCentavos: number;
  activeProvider: RecordingActiveProvider;
  providerCredentials: Partial<Record<RecordingProviderId, Record<string, string> | null>>;
}>;

function mergeProviderCredentials(
  current: Partial<Record<RecordingProviderId, EncryptedCredentialBlob>>,
  patch: Partial<Record<RecordingProviderId, Record<string, string> | null>> | undefined,
): Partial<Record<RecordingProviderId, EncryptedCredentialBlob>> {
  if (patch === undefined) {
    return current;
  }
  const next: Partial<Record<RecordingProviderId, EncryptedCredentialBlob>> = { ...current };
  for (const providerId of RECORDING_PROVIDER_IDS) {
    const incoming = patch[providerId];
    if (incoming === null) {
      delete next[providerId];
      continue;
    }
    if (incoming === undefined) {
      continue;
    }
    const existingBlob = current[providerId];
    let mergedPlain: Record<string, string> = {};
    if (existingBlob !== undefined) {
      try {
        mergedPlain = { ...decryptMeetingCredentials(existingBlob) };
      } catch {
        mergedPlain = {};
      }
    }
    for (const [key, value] of Object.entries(incoming)) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        mergedPlain[key] = trimmed;
      }
    }
    if (providerId === 'fathom') {
      const extracted = extractFathomFromPlain(mergedPlain);
      if (extracted === null) {
        throw new RecordingSettingsCredentialValidationError(
          'Fathom requires API key and webhook secret. Host email is optional but recommended for matching.',
        );
      }
    }
    if (Object.keys(mergedPlain).length === 0) {
      delete next[providerId];
      continue;
    }
    if (!canEncryptMeetingCredentials()) {
      throw new RecordingSettingsCredentialValidationError(
        'MEETINGS_CREDENTIALS_MASTER_KEY is not configured (min 32 characters).',
      );
    }
    next[providerId] = encryptMeetingCredentials(mergedPlain);
  }
  return next;
}

export async function updateRecordingSettings(patch: UpdateRecordingSettingsPatch): Promise<RecordingSettingsAdminView> {
  const current = await getRecordingSettings();
  const merged = mergeDocument(await loadDocument());
  const nextEnabled = patch.recordingsEnabled ?? current.recordingsEnabled;
  let nextActive = patch.activeProvider ?? current.activeProvider;
  if (!nextEnabled) {
    nextActive = 'none';
  } else if (nextActive === 'none' && patch.activeProvider === undefined && current.activeProvider === 'none') {
    nextActive = 'fathom';
  }
  const next: Omit<RecordingSettingsDocument, 'updatedAt'> = {
    _id: RECORDING_SETTINGS_DOCUMENT_ID,
    recordingsEnabled: nextEnabled,
    recordingOptInPriceCentavos: clampOptInPriceCentavos(
      patch.recordingOptInPriceCentavos ?? current.recordingOptInPriceCentavos,
    ),
    activeProvider: nextActive,
    providerCredentials: mergeProviderCredentials(merged.providerCredentials, patch.providerCredentials),
  };
  if (!process.env.MONGODB_URI) {
    return getRecordingSettingsAdminView();
  }
  const db = await getDb();
  const row: RecordingSettingsDocument = { ...next, updatedAt: new Date() };
  await db.collection<RecordingSettingsDocument>(COLLECTIONS.recordingSettings).replaceOne(
    { _id: RECORDING_SETTINGS_DOCUMENT_ID },
    row,
    { upsert: true },
  );
  return getRecordingSettingsAdminView();
}

export async function executeFathomConnectionTest(): Promise<{ readonly ok: boolean; readonly message: string }> {
  const credentials = await resolveFathomCredentialsForRuntime();
  const envOnly = credentials === null ? readFathomCredentialsFromEnv() : credentials;
  const creds = envOnly ?? credentials;
  if (creds === null) {
    return { ok: false, message: 'Fathom credentials are not configured.' };
  }
  try {
    const response = await fetch('https://api.fathom.ai/external/v1/meetings?limit=1', {
      headers: { 'X-Api-Key': creds.apiKey },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { ok: false, message: `Fathom API returned ${response.status}.` };
    }
    return { ok: true, message: 'Connected to Fathom API successfully.' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, message };
  }
}
