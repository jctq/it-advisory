import { COLLECTIONS } from '@/domain/collections';
import {
  VIDEO_MEETING_PROVIDER_IDS,
  type MeetingSettingsDocument,
  type VideoMeetingActiveProvider,
  type VideoMeetingProviderId,
} from '@/domain/meeting-types';
import type { EncryptedCredentialBlob, PaymentGatewayCredentialsPlain } from '@/domain/payment-types';
import {
  canEncryptMeetingCredentials,
  decryptMeetingCredentials,
  encryptMeetingCredentials,
} from '@/lib/server/meeting-credentials-crypto';
import { maskCredentialHint } from '@/lib/server/payment-credentials-crypto';
import { fetchGoogleAccessTokenFromRefresh, type GoogleMeetOAuthCredentials } from '@/lib/google-meet/google-calendar-meet-api';
import {
  fetchMicrosoftGraphAppAccessToken,
  type MicrosoftTeamsAppCredentials,
} from '@/lib/microsoft-teams/microsoft-graph-teams-meetings-api';
import { getDb } from '@/lib/mongodb';
import { fetchZoomAccessToken, type ZoomServerCredentials } from '@/lib/zoom/zoom-api';

export const MEETING_SETTINGS_DOCUMENT_ID = 'default';

/** Thrown when admin-submitted meeting provider fields fail validation (maps to HTTP 400). */
export class MeetingSettingsCredentialValidationError extends Error {
  public override readonly name = 'MeetingSettingsCredentialValidationError';
  public constructor(message: string) {
    super(message);
  }
}

export type MeetingProviderAdminStatus = {
  readonly id: VideoMeetingProviderId;
  readonly label: string;
  readonly description: string;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

export type MeetingSettingsAdminView = {
  readonly activeProvider: VideoMeetingActiveProvider;
  readonly canStoreCredentials: boolean;
  readonly providers: readonly MeetingProviderAdminStatus[];
  readonly envZoomFallbackAvailable: boolean;
  readonly envGoogleMeetFallbackAvailable: boolean;
  readonly envMicrosoftTeamsFallbackAvailable: boolean;
};

export type VideoMeetingCreationContext =
  | { readonly provider: 'zoom'; readonly zoom: ZoomServerCredentials }
  | { readonly provider: 'googleMeet'; readonly googleMeet: GoogleMeetOAuthCredentials }
  | { readonly provider: 'microsoftTeams'; readonly microsoftTeams: MicrosoftTeamsAppCredentials };

function readZoomCredentialsFromEnv(): ZoomServerCredentials | null {
  const accountId = process.env.ZOOM_ACCOUNT_ID?.trim() ?? '';
  const clientId = process.env.ZOOM_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim() ?? '';
  const hostUserId = process.env.ZOOM_HOST_USER_ID?.trim() ?? '';
  if (accountId.length === 0 || clientId.length === 0 || clientSecret.length === 0 || hostUserId.length === 0) {
    return null;
  }
  return { accountId, clientId, clientSecret, hostUserId };
}

function readGoogleMeetCredentialsFromEnv(): GoogleMeetOAuthCredentials | null {
  const clientId = process.env.GOOGLE_MEET_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET?.trim() ?? '';
  const refreshToken = process.env.GOOGLE_MEET_REFRESH_TOKEN?.trim() ?? '';
  const calendarRaw = process.env.GOOGLE_MEET_CALENDAR_ID?.trim() ?? '';
  if (clientId.length === 0 || clientSecret.length === 0 || refreshToken.length === 0) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    refreshToken,
    calendarId: calendarRaw.length > 0 ? calendarRaw : 'primary',
  };
}

function readMicrosoftTeamsCredentialsFromEnv(): MicrosoftTeamsAppCredentials | null {
  const tenantId = process.env.MICROSOFT_TEAMS_TENANT_ID?.trim() ?? '';
  const clientId = process.env.MICROSOFT_TEAMS_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.MICROSOFT_TEAMS_CLIENT_SECRET?.trim() ?? '';
  const organizerUserId = process.env.MICROSOFT_TEAMS_ORGANIZER_USER_ID?.trim() ?? '';
  if (tenantId.length === 0 || clientId.length === 0 || clientSecret.length === 0 || organizerUserId.length === 0) {
    return null;
  }
  return { tenantId, clientId, clientSecret, organizerUserId };
}

function envZoomFallbackAvailable(): boolean {
  return readZoomCredentialsFromEnv() !== null;
}

function envGoogleMeetFallbackAvailable(): boolean {
  return readGoogleMeetCredentialsFromEnv() !== null;
}

function envMicrosoftTeamsFallbackAvailable(): boolean {
  return readMicrosoftTeamsCredentialsFromEnv() !== null;
}

function defaultActiveProvider(): VideoMeetingActiveProvider {
  return 'none';
}

function mergeDocument(doc: MeetingSettingsDocument | null): Omit<MeetingSettingsDocument, 'updatedAt'> {
  const base: Omit<MeetingSettingsDocument, 'updatedAt'> = {
    _id: MEETING_SETTINGS_DOCUMENT_ID,
    activeProvider: defaultActiveProvider(),
    providerCredentials: {},
  };
  if (doc === null) {
    return base;
  }
  const active: VideoMeetingActiveProvider =
    doc.activeProvider === 'none' || VIDEO_MEETING_PROVIDER_IDS.includes(doc.activeProvider as VideoMeetingProviderId)
      ? doc.activeProvider
      : base.activeProvider;
  return {
    _id: MEETING_SETTINGS_DOCUMENT_ID,
    activeProvider: active,
    providerCredentials: doc.providerCredentials ?? {},
  };
}

async function loadDocument(): Promise<MeetingSettingsDocument | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  return db.collection<MeetingSettingsDocument>(COLLECTIONS.meetingSettings).findOne({ _id: MEETING_SETTINGS_DOCUMENT_ID });
}

function mergeCredentialFields(
  keys: readonly string[],
  incoming: Record<string, string>,
  existingBlob: EncryptedCredentialBlob | undefined,
): PaymentGatewayCredentialsPlain {
  let previous: PaymentGatewayCredentialsPlain = {};
  if (existingBlob !== undefined) {
    try {
      previous = decryptMeetingCredentials(existingBlob);
    } catch {
      previous = {};
    }
  }
  const merged: Record<string, string> = {};
  for (const key of keys) {
    const inc = incoming[key]?.trim() ?? '';
    if (inc.length > 0) {
      merged[key] = inc;
    } else {
      const fromPrev = typeof previous[key] === 'string' ? previous[key].trim() : '';
      if (fromPrev.length > 0) {
        merged[key] = fromPrev;
      }
    }
  }
  return merged;
}

function extractZoomFromPlain(plain: PaymentGatewayCredentialsPlain): ZoomServerCredentials | null {
  const accountId = typeof plain.accountId === 'string' ? plain.accountId.trim() : '';
  const clientId = typeof plain.clientId === 'string' ? plain.clientId.trim() : '';
  const clientSecret = typeof plain.clientSecret === 'string' ? plain.clientSecret.trim() : '';
  const hostUserId = typeof plain.hostUserId === 'string' ? plain.hostUserId.trim() : '';
  if (accountId.length === 0 || clientId.length === 0 || clientSecret.length === 0 || hostUserId.length === 0) {
    return null;
  }
  return { accountId, clientId, clientSecret, hostUserId };
}

function extractGoogleMeetFromPlain(plain: PaymentGatewayCredentialsPlain): GoogleMeetOAuthCredentials | null {
  const clientId = typeof plain.clientId === 'string' ? plain.clientId.trim() : '';
  const clientSecret = typeof plain.clientSecret === 'string' ? plain.clientSecret.trim() : '';
  const refreshToken = typeof plain.refreshToken === 'string' ? plain.refreshToken.trim() : '';
  if (clientId.length === 0 || clientSecret.length === 0 || refreshToken.length === 0) {
    return null;
  }
  const calendarRaw = typeof plain.calendarId === 'string' ? plain.calendarId.trim() : '';
  return {
    clientId,
    clientSecret,
    refreshToken,
    calendarId: calendarRaw.length > 0 ? calendarRaw : 'primary',
  };
}

function extractMicrosoftTeamsFromPlain(plain: PaymentGatewayCredentialsPlain): MicrosoftTeamsAppCredentials | null {
  const tenantId = typeof plain.tenantId === 'string' ? plain.tenantId.trim() : '';
  const clientId = typeof plain.clientId === 'string' ? plain.clientId.trim() : '';
  const clientSecret = typeof plain.clientSecret === 'string' ? plain.clientSecret.trim() : '';
  const organizerUserId = typeof plain.organizerUserId === 'string' ? plain.organizerUserId.trim() : '';
  if (tenantId.length === 0 || clientId.length === 0 || clientSecret.length === 0 || organizerUserId.length === 0) {
    return null;
  }
  return { tenantId, clientId, clientSecret, organizerUserId };
}

function resolveCredentialHintForPlain(plain: PaymentGatewayCredentialsPlain): string | null {
  const secret = typeof plain.clientSecret === 'string' ? plain.clientSecret.trim() : '';
  if (secret.length > 0) {
    return maskCredentialHint({ clientSecret: secret });
  }
  const refresh = typeof plain.refreshToken === 'string' ? plain.refreshToken.trim() : '';
  if (refresh.length > 0) {
    return maskCredentialHint({ refreshToken: refresh });
  }
  return null;
}

function tryDecryptZoomFromMerged(merged: Omit<MeetingSettingsDocument, 'updatedAt'>): ZoomServerCredentials | null {
  const blob = merged.providerCredentials.zoom;
  if (blob === undefined) {
    return null;
  }
  try {
    return extractZoomFromPlain(decryptMeetingCredentials(blob));
  } catch {
    return null;
  }
}

function tryDecryptGoogleMeetFromMerged(merged: Omit<MeetingSettingsDocument, 'updatedAt'>): GoogleMeetOAuthCredentials | null {
  const blob = merged.providerCredentials.googleMeet;
  if (blob === undefined) {
    return null;
  }
  try {
    return extractGoogleMeetFromPlain(decryptMeetingCredentials(blob));
  } catch {
    return null;
  }
}

function tryDecryptMicrosoftTeamsFromMerged(
  merged: Omit<MeetingSettingsDocument, 'updatedAt'>,
): MicrosoftTeamsAppCredentials | null {
  const blob = merged.providerCredentials.microsoftTeams;
  if (blob === undefined) {
    return null;
  }
  try {
    return extractMicrosoftTeamsFromPlain(decryptMeetingCredentials(blob));
  } catch {
    return null;
  }
}

/**
 * Resolves Zoom Server-to-Server credentials: admin-stored (when Zoom is active and configured), else optional env vars.
 */
export async function resolveZoomServerCredentialsForRuntime(): Promise<ZoomServerCredentials | null> {
  const merged = mergeDocument(await loadDocument());
  if (merged.activeProvider === 'zoom') {
    const fromAdmin = tryDecryptZoomFromMerged(merged);
    if (fromAdmin !== null) {
      return fromAdmin;
    }
  }
  return readZoomCredentialsFromEnv();
}

/**
 * Resolves which video provider should create meetings for confirmed bookings (admin active selection and env fallbacks).
 */
export async function resolveVideoMeetingCreationContext(): Promise<VideoMeetingCreationContext | null> {
  const merged = mergeDocument(await loadDocument());
  if (merged.activeProvider === 'none') {
    const envZoom = readZoomCredentialsFromEnv();
    return envZoom !== null ? { provider: 'zoom', zoom: envZoom } : null;
  }
  if (merged.activeProvider === 'zoom') {
    const zoom = tryDecryptZoomFromMerged(merged) ?? readZoomCredentialsFromEnv();
    return zoom !== null ? { provider: 'zoom', zoom } : null;
  }
  if (merged.activeProvider === 'googleMeet') {
    const googleMeet = tryDecryptGoogleMeetFromMerged(merged) ?? readGoogleMeetCredentialsFromEnv();
    return googleMeet !== null ? { provider: 'googleMeet', googleMeet } : null;
  }
  const microsoftTeams = tryDecryptMicrosoftTeamsFromMerged(merged) ?? readMicrosoftTeamsCredentialsFromEnv();
  return microsoftTeams !== null ? { provider: 'microsoftTeams', microsoftTeams } : null;
}

const PROVIDER_ROWS = [
  {
    id: 'zoom' as const,
    label: 'Zoom',
    description: 'Server-to-Server OAuth: scheduled meetings and join URLs for confirmed bookings.',
  },
  {
    id: 'googleMeet' as const,
    label: 'Google Meet',
    description: 'OAuth desktop app + Calendar API: creates a calendar event with a Meet link (delegated user).',
  },
  {
    id: 'microsoftTeams' as const,
    label: 'Microsoft Teams',
    description: 'Azure AD app (client credentials) + Graph: creates an online meeting for the organizer user.',
  },
] as const satisfies readonly Omit<MeetingProviderAdminStatus, 'configured' | 'credentialHint'>[];

export async function getMeetingSettingsAdminView(): Promise<MeetingSettingsAdminView> {
  const merged = mergeDocument(await loadDocument());
  const blobs = merged.providerCredentials;
  const providers: MeetingProviderAdminStatus[] = PROVIDER_ROWS.map((row) => {
    const blob = blobs[row.id];
    let configured = false;
    let credentialHint: string | null = null;
    if (blob !== undefined) {
      try {
        const plain = decryptMeetingCredentials(blob);
        if (row.id === 'zoom') {
          configured = extractZoomFromPlain(plain) !== null;
        } else if (row.id === 'googleMeet') {
          configured = extractGoogleMeetFromPlain(plain) !== null;
        } else {
          configured = extractMicrosoftTeamsFromPlain(plain) !== null;
        }
        if (configured) {
          credentialHint = resolveCredentialHintForPlain(plain);
        }
      } catch {
        configured = false;
      }
    }
    return { ...row, configured, credentialHint };
  });
  return {
    activeProvider: merged.activeProvider,
    canStoreCredentials: canEncryptMeetingCredentials(),
    providers,
    envZoomFallbackAvailable: envZoomFallbackAvailable(),
    envGoogleMeetFallbackAvailable: envGoogleMeetFallbackAvailable(),
    envMicrosoftTeamsFallbackAvailable: envMicrosoftTeamsFallbackAvailable(),
  };
}

export type UpdateMeetingSettingsPatch = Partial<{
  activeProvider: VideoMeetingActiveProvider;
  providerCredentials: Partial<Record<VideoMeetingProviderId, Record<string, string> | null>>;
}>;

function encryptValidatedProviderBlob(
  providerId: VideoMeetingProviderId,
  filtered: Record<string, string>,
  existingBlob: EncryptedCredentialBlob | undefined,
): EncryptedCredentialBlob {
  if (providerId === 'zoom') {
    const merged = mergeCredentialFields(['accountId', 'clientId', 'clientSecret', 'hostUserId'], filtered, existingBlob);
    if (extractZoomFromPlain(merged) === null) {
      throw new MeetingSettingsCredentialValidationError(
        'Zoom credentials must include account id, client id, client secret, and host user id (or email).',
      );
    }
    return encryptMeetingCredentials(merged);
  }
  if (providerId === 'googleMeet') {
    const merged = mergeCredentialFields(['clientId', 'clientSecret', 'refreshToken', 'calendarId'], filtered, existingBlob);
    if (extractGoogleMeetFromPlain(merged) === null) {
      throw new MeetingSettingsCredentialValidationError(
        'Google Meet credentials must include OAuth client id, client secret, and refresh token (optional calendar id defaults to primary).',
      );
    }
    return encryptMeetingCredentials(merged);
  }
  const merged = mergeCredentialFields(['tenantId', 'clientId', 'clientSecret', 'organizerUserId'], filtered, existingBlob);
  if (extractMicrosoftTeamsFromPlain(merged) === null) {
    throw new MeetingSettingsCredentialValidationError(
      'Microsoft Teams credentials must include tenant id, client id, client secret, and organizer user id or UPN.',
    );
  }
  return encryptMeetingCredentials(merged);
}

export async function updateMeetingSettings(patch: UpdateMeetingSettingsPatch): Promise<MeetingSettingsAdminView> {
  const current = mergeDocument(await loadDocument());
  const blobs: Partial<Record<VideoMeetingProviderId, EncryptedCredentialBlob>> = {
    ...current.providerCredentials,
  };
  const nextActive: VideoMeetingActiveProvider =
    patch.activeProvider !== undefined &&
    (patch.activeProvider === 'none' || VIDEO_MEETING_PROVIDER_IDS.includes(patch.activeProvider))
      ? patch.activeProvider
      : current.activeProvider;
  if (patch.providerCredentials !== undefined) {
    for (const providerId of VIDEO_MEETING_PROVIDER_IDS) {
      const incoming = patch.providerCredentials[providerId];
      if (incoming === undefined) {
        continue;
      }
      if (incoming === null) {
        delete blobs[providerId];
        continue;
      }
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          filtered[key] = value.trim();
        }
      }
      if (Object.keys(filtered).length === 0) {
        delete blobs[providerId];
        continue;
      }
      blobs[providerId] = encryptValidatedProviderBlob(providerId, filtered, blobs[providerId]);
    }
  }
  if (!process.env.MONGODB_URI) {
    return getMeetingSettingsAdminView();
  }
  const db = await getDb();
  const row: MeetingSettingsDocument = {
    _id: MEETING_SETTINGS_DOCUMENT_ID,
    activeProvider: nextActive,
    providerCredentials: blobs,
    updatedAt: new Date(),
  };
  await db.collection<MeetingSettingsDocument>(COLLECTIONS.meetingSettings).replaceOne({ _id: MEETING_SETTINGS_DOCUMENT_ID }, row, {
    upsert: true,
  });
  return getMeetingSettingsAdminView();
}

export async function executeZoomMeetingConnectionTest(): Promise<{ readonly ok: boolean; readonly message: string }> {
  const merged = mergeDocument(await loadDocument());
  let credentials: ZoomServerCredentials | null = null;
  if (merged.activeProvider === 'zoom') {
    credentials = tryDecryptZoomFromMerged(merged);
  }
  if (credentials === null) {
    credentials = readZoomCredentialsFromEnv();
  }
  if (credentials === null) {
    return { ok: false, message: 'No Zoom credentials configured (admin or environment).' };
  }
  const token = await fetchZoomAccessToken(credentials);
  if (token === null) {
    return { ok: false, message: 'Zoom rejected the token request. Check account id, client id, and client secret.' };
  }
  return { ok: true, message: 'Zoom Server-to-Server OAuth succeeded (access token issued).' };
}

export async function executeGoogleMeetConnectionTest(): Promise<{ readonly ok: boolean; readonly message: string }> {
  const merged = mergeDocument(await loadDocument());
  let credentials: GoogleMeetOAuthCredentials | null = null;
  if (merged.activeProvider === 'googleMeet') {
    credentials = tryDecryptGoogleMeetFromMerged(merged);
  }
  if (credentials === null) {
    credentials = readGoogleMeetCredentialsFromEnv();
  }
  if (credentials === null) {
    return { ok: false, message: 'No Google Meet credentials configured (admin or environment).' };
  }
  const tokenResult = await fetchGoogleAccessTokenFromRefresh(credentials);
  if (!tokenResult.ok) {
    return {
      ok: false,
      message: `Google OAuth refresh failed: ${tokenResult.failureDetail}. Typical fix: use a refresh token issued for this same client id and secret; see docs/google-meet-oauth-setup.md.`,
    };
  }
  if (merged.activeProvider !== 'googleMeet') {
    return {
      ok: true,
      message:
        'Google OAuth refresh succeeded. New paid bookings will not use Meet until you select Google Meet under Active provider above and click Save (or set GOOGLE_MEET_* env with Google Meet active).',
    };
  }
  return { ok: true, message: 'Google OAuth refresh succeeded (access token issued).' };
}

export async function executeMicrosoftTeamsConnectionTest(): Promise<{ readonly ok: boolean; readonly message: string }> {
  const merged = mergeDocument(await loadDocument());
  let credentials: MicrosoftTeamsAppCredentials | null = null;
  if (merged.activeProvider === 'microsoftTeams') {
    credentials = tryDecryptMicrosoftTeamsFromMerged(merged);
  }
  if (credentials === null) {
    credentials = readMicrosoftTeamsCredentialsFromEnv();
  }
  if (credentials === null) {
    return { ok: false, message: 'No Microsoft Teams credentials configured (admin or environment).' };
  }
  const token = await fetchMicrosoftGraphAppAccessToken(credentials);
  if (token === null) {
    return {
      ok: false,
      message: 'Microsoft token request failed. Check tenant id, client id, client secret, and app registration permissions.',
    };
  }
  const userSegment = encodeURIComponent(credentials.organizerUserId.trim());
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userSegment}?$select=id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const detail = body.error?.message ?? response.statusText;
    return {
      ok: false,
      message: `Graph could not read organizer user (${detail}). Grant User.Read.All or OnlineMeetings.ReadWrite.All and admin consent.`,
    };
  }
  if (merged.activeProvider !== 'microsoftTeams') {
    return {
      ok: true,
      message:
        'Microsoft Graph app token issued and organizer user resolved. New paid bookings will not use Teams until you select Microsoft Teams under Active provider above and click Save.',
    };
  }
  return { ok: true, message: 'Microsoft Graph app token issued and organizer user resolved.' };
}
