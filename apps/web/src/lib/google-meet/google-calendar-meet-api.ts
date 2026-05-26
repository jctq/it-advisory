import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API_ORIGIN = 'https://www.googleapis.com/calendar/v3';

export type GoogleMeetOAuthCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  readonly calendarId: string;
};

export type GoogleRefreshAccessTokenResult =
  | { readonly ok: true; readonly accessToken: string }
  | { readonly ok: false; readonly failureDetail: string };

type GoogleOAuthTokenJson = {
  readonly access_token?: string;
  readonly error?: string;
  readonly error_description?: string;
};

type GoogleCalendarEventJson = {
  readonly id?: string;
  readonly hangoutLink?: string;
  readonly conferenceData?: {
    readonly entryPoints?: ReadonlyArray<{ readonly entryPointType?: string; readonly uri?: string }>;
  };
};

function buildGoogleTokenEndpointFailureMessage(
  status: number,
  payload: GoogleOAuthTokenJson,
): string {
  const code = typeof payload.error === 'string' ? payload.error.trim() : '';
  const desc = typeof payload.error_description === 'string' ? payload.error_description.trim() : '';
  if (code.length > 0 && desc.length > 0) {
    return `${code}: ${desc}`;
  }
  if (desc.length > 0) {
    return desc;
  }
  if (code.length > 0) {
    return code;
  }
  return `HTTP ${String(status)}`;
}

export async function fetchGoogleAccessTokenFromRefresh(
  credentials: GoogleMeetOAuthCredentials,
): Promise<GoogleRefreshAccessTokenResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  let payload: GoogleOAuthTokenJson;
  try {
    payload = (await response.json()) as GoogleOAuthTokenJson;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const detail = buildGoogleTokenEndpointFailureMessage(response.status, payload);
    console.error('[google-meet] token request failed', response.status, detail);
    return {
      ok: false,
      failureDetail: detail,
    };
  }
  const token = payload.access_token;
  if (typeof token !== 'string' || token.trim().length === 0) {
    console.error('[google-meet] token response missing access_token');
    return {
      ok: false,
      failureDetail: 'Token response had no access_token (unexpected).',
    };
  }
  return { ok: true, accessToken: token.trim() };
}

function resolveMeetJoinUrl(payload: GoogleCalendarEventJson): string {
  const hangout = typeof payload.hangoutLink === 'string' ? payload.hangoutLink.trim() : '';
  if (hangout.length > 0) {
    return hangout;
  }
  const entries = payload.conferenceData?.entryPoints;
  if (entries === undefined) {
    return '';
  }
  for (const entry of entries) {
    if (entry.entryPointType === 'video') {
      const uri = typeof entry.uri === 'string' ? entry.uri.trim() : '';
      if (uri.length > 0) {
        return uri;
      }
    }
  }
  return '';
}

const GOOGLE_EVENT_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss" as const;

export type GoogleCalendarMeetAttendee = {
  readonly email: string;
  readonly displayName: string;
};

export async function requestCreateGoogleCalendarEventWithMeet(
  accessToken: string,
  credentials: GoogleMeetOAuthCredentials,
  input: {
    readonly topic: string;
    readonly description?: string;
    readonly startsAt: Date;
    readonly durationMinutes: number;
    readonly timeZone: string;
    readonly attendees?: readonly GoogleCalendarMeetAttendee[];
  },
): Promise<{ readonly joinUrl: string; readonly eventId: string } | null> {
  const timeZone = input.timeZone.trim().length > 0 ? input.timeZone : 'UTC';
  const endAt = addMinutes(input.startsAt, input.durationMinutes);
  const calendarSegment = encodeURIComponent(credentials.calendarId);
  const hasAttendees = input.attendees !== undefined && input.attendees.length > 0;
  const sendUpdatesQuery = hasAttendees ? '&sendUpdates=all' : '';
  const url = `${GOOGLE_CALENDAR_API_ORIGIN}/calendars/${calendarSegment}/events?conferenceDataVersion=1${sendUpdatesQuery}`;
  const requestId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const eventBody: Record<string, unknown> = {
    summary: input.topic,
    start: {
      dateTime: formatInTimeZone(input.startsAt, timeZone, GOOGLE_EVENT_LOCAL_FORMAT),
      timeZone,
    },
    end: {
      dateTime: formatInTimeZone(endAt, timeZone, GOOGLE_EVENT_LOCAL_FORMAT),
      timeZone,
    },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
  if (description.length > 0) {
    eventBody.description = description;
  }
  if (hasAttendees) {
    eventBody.attendees = input.attendees!.map((attendee) => ({
      email: attendee.email.trim(),
      displayName: attendee.displayName.trim(),
      responseStatus: 'needsAction',
    }));
    eventBody.guestsCanModify = false;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  });
  const payload = (await response.json()) as GoogleCalendarEventJson & {
    readonly error?: { readonly message?: string; readonly errors?: readonly unknown[] };
    readonly message?: string;
  };
  if (!response.ok) {
    const apiMessage =
      payload.error?.message ?? (typeof payload.message === 'string' ? payload.message : JSON.stringify(payload.error ?? payload));
    console.error('[google-meet] create event failed', response.status, apiMessage);
    return null;
  }
  const joinUrl = resolveMeetJoinUrl(payload);
  if (joinUrl.length === 0) {
    console.error('[google-meet] create event response missing Meet join URL');
    return null;
  }
  const eventId = typeof payload.id === 'string' ? payload.id.trim() : '';
  if (eventId.length === 0) {
    console.error('[google-meet] create event response missing event id');
    return null;
  }
  return { joinUrl, eventId };
}
