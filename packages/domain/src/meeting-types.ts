import type { EncryptedCredentialBlob } from './payment-types.js';

/** Video meeting backends (only one active at a time). */
export const VIDEO_MEETING_PROVIDER_IDS = ['zoom', 'googleMeet', 'microsoftTeams'] as const;

export type VideoMeetingProviderId = (typeof VIDEO_MEETING_PROVIDER_IDS)[number];

export type VideoMeetingActiveProvider = 'none' | VideoMeetingProviderId;

/** Singleton `_id: 'default'` — admin video meeting / conference configuration. */
export type MeetingSettingsDocument = {
  readonly _id: string;
  readonly activeProvider: VideoMeetingActiveProvider;
  readonly providerCredentials: Partial<Record<VideoMeetingProviderId, EncryptedCredentialBlob>>;
  readonly updatedAt: Date;
};
