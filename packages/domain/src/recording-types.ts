import type { EncryptedCredentialBlob } from './payment-types.js';

export const RECORDING_PROVIDER_IDS = ['fathom'] as const;

export type RecordingProviderId = (typeof RECORDING_PROVIDER_IDS)[number];

export type RecordingActiveProvider = 'none' | RecordingProviderId;

export const FATHOM_MATCH_STATUSES = [
  'pending',
  'linked',
  'ambiguous',
  'unmatched',
  'manual',
  'skipped',
] as const;

export type FathomMatchStatus = (typeof FATHOM_MATCH_STATUSES)[number];

/** Singleton `_id: 'default'` — consultation recording / notetaker configuration. */
export type RecordingSettingsDocument = {
  readonly _id: 'default';
  readonly recordingsEnabled: boolean;
  /** Surcharge when customer opts in at checkout (centavos). 0 = free opt-in. */
  readonly recordingOptInPriceCentavos: number;
  readonly activeProvider: RecordingActiveProvider;
  readonly providerCredentials: Partial<Record<RecordingProviderId, EncryptedCredentialBlob>>;
  readonly updatedAt: Date;
};

export type FathomWebhookDeliveryDocument = {
  readonly webhookId: string;
  readonly receivedAt: Date;
  readonly bookingId?: string;
  readonly fathomRecordingId?: string;
  readonly matchStatus: FathomMatchStatus | 'ignored';
  readonly rawPayloadSnippet?: string;
};
