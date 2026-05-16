const MICROSOFT_TOKEN_URL_TEMPLATE = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token' as const;
const GRAPH_API_ORIGIN = 'https://graph.microsoft.com/v1.0' as const;

export type MicrosoftTeamsAppCredentials = {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly organizerUserId: string;
};

type MicrosoftTokenJson = {
  readonly access_token?: string;
  readonly error?: string;
  readonly error_description?: string;
};

type MicrosoftOnlineMeetingJson = {
  readonly id?: string;
  readonly joinWebUrl?: string;
  readonly error?: { readonly message?: string };
};

export async function fetchMicrosoftGraphAppAccessToken(credentials: MicrosoftTeamsAppCredentials): Promise<string | null> {
  const tokenUrl = MICROSOFT_TOKEN_URL_TEMPLATE.replace('{tenant}', encodeURIComponent(credentials.tenantId));
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json()) as MicrosoftTokenJson;
  if (!response.ok) {
    console.error(
      '[microsoft-teams] token request failed',
      response.status,
      payload.error ?? payload.error_description ?? payload,
    );
    return null;
  }
  const token = payload.access_token;
  if (typeof token !== 'string' || token.trim().length === 0) {
    console.error('[microsoft-teams] token response missing access_token');
    return null;
  }
  return token.trim();
}

export async function requestCreateMicrosoftTeamsOnlineMeeting(
  accessToken: string,
  credentials: MicrosoftTeamsAppCredentials,
  input: { readonly topic: string; readonly startsAt: Date; readonly durationMinutes: number },
): Promise<{ readonly joinUrl: string; readonly meetingId: string } | null> {
  const endAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
  const userSegment = encodeURIComponent(credentials.organizerUserId.trim());
  const response = await fetch(`${GRAPH_API_ORIGIN}/users/${userSegment}/onlineMeetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDateTime: input.startsAt.toISOString(),
      endDateTime: endAt.toISOString(),
      subject: input.topic,
    }),
  });
  const payload = (await response.json()) as MicrosoftOnlineMeetingJson;
  if (!response.ok) {
    console.error('[microsoft-teams] create meeting failed', response.status, payload.error?.message ?? payload);
    return null;
  }
  const joinUrl = typeof payload.joinWebUrl === 'string' ? payload.joinWebUrl.trim() : '';
  if (joinUrl.length === 0) {
    console.error('[microsoft-teams] create meeting response missing joinWebUrl');
    return null;
  }
  const rawId = payload.id;
  const meetingId = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : '';
  return { joinUrl, meetingId };
}
