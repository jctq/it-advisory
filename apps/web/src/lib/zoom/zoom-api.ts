const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_ORIGIN = 'https://api.zoom.us/v2';

export type ZoomServerCredentials = {
  readonly accountId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly hostUserId: string;
};

type ZoomOAuthTokenJson = {
  readonly access_token?: string;
  readonly error?: string;
};

type ZoomCreateMeetingJson = {
  readonly id?: number | string;
  readonly join_url?: string;
  readonly message?: string;
};

export async function fetchZoomAccessToken(credentials: ZoomServerCredentials): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: credentials.accountId,
  });
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload = (await response.json()) as ZoomOAuthTokenJson;
  if (!response.ok) {
    console.error('[zoom] token request failed', response.status, payload.error ?? payload);
    return null;
  }
  const token = payload.access_token;
  if (typeof token !== 'string' || token.trim().length === 0) {
    console.error('[zoom] token response missing access_token');
    return null;
  }
  return token.trim();
}

function formatZoomUtcStartTime(startsAt: Date): string {
  return startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export async function requestCreateZoomScheduledMeeting(
  accessToken: string,
  credentials: ZoomServerCredentials,
  input: { readonly topic: string; readonly startsAt: Date; readonly durationMinutes: number; readonly timezone: string },
): Promise<{ readonly joinUrl: string; readonly meetingId: string } | null> {
  const encodedUser = encodeURIComponent(credentials.hostUserId);
  const response = await fetch(`${ZOOM_API_ORIGIN}/users/${encodedUser}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: formatZoomUtcStartTime(input.startsAt),
      duration: input.durationMinutes,
      timezone: input.timezone,
      settings: {
        waiting_room: false,
        join_before_host: true,
      },
    }),
  });
  const payload = (await response.json()) as ZoomCreateMeetingJson;
  if (!response.ok) {
    console.error('[zoom] create meeting failed', response.status, payload.message ?? payload);
    return null;
  }
  const joinUrl = typeof payload.join_url === 'string' ? payload.join_url.trim() : '';
  if (joinUrl.length === 0) {
    console.error('[zoom] create meeting response missing join_url');
    return null;
  }
  const rawId = payload.id;
  const meetingId = rawId === undefined || rawId === null ? '' : String(rawId);
  return { joinUrl, meetingId };
}
