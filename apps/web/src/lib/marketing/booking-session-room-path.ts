/**
 * Builds the marketing session room URL, optionally pre-filling the booking reference.
 */
export type BuildBookingSessionRoomPathInput = {
  readonly bookingReference?: string | null;
  readonly accessToken?: string | null;
};

function normalizeBuildBookingSessionRoomPathInput(
  input?: string | null | BuildBookingSessionRoomPathInput,
): BuildBookingSessionRoomPathInput {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input === 'string') {
    return { bookingReference: input };
  }
  return input;
}

export function buildBookingSessionRoomPath(
  input?: string | null | BuildBookingSessionRoomPathInput,
): string {
  const resolved = normalizeBuildBookingSessionRoomPathInput(input);
  const params = new URLSearchParams();
  const bookingReference = resolved.bookingReference?.trim() ?? '';
  const accessToken = resolved.accessToken?.trim() ?? '';
  if (bookingReference.length > 0) {
    params.set('bookingReference', bookingReference);
  }
  if (accessToken.length > 0) {
    params.set('token', accessToken);
  }
  const query = params.toString();
  if (query.length === 0) {
    return '/book/session';
  }
  return `/book/session?${query}`;
}

/**
 * Absolute session room URL for emails and calendar location fields.
 */
export function buildAbsoluteBookingSessionRoomUrl(
  siteOrigin: string,
  input: string | BuildBookingSessionRoomPathInput,
): string {
  const origin = siteOrigin.trim().replace(/\/$/, '');
  const path = buildBookingSessionRoomPath(input);
  if (origin.length === 0) {
    return path;
  }
  return `${origin}${path}`;
}

/**
 * Derives the 8-character booking reference suffix from a Mongo booking id.
 */
export function resolveBookingReferenceFromBookingId(bookingId: string): string {
  return bookingId.replace(/\s/g, '').slice(-8).toUpperCase();
}

/**
 * Absolute session room URL for calendar location fields (client or server).
 */
export function resolveBookingSessionRoomCalendarLocation(
  bookingReference: string,
  siteOrigin?: string | null,
  accessToken?: string | null,
): string {
  const trimmedOrigin = siteOrigin?.trim().replace(/\/$/, '') ?? '';
  const pathInput: BuildBookingSessionRoomPathInput = {
    bookingReference,
    accessToken,
  };
  if (trimmedOrigin.length > 0) {
    return buildAbsoluteBookingSessionRoomUrl(trimmedOrigin, pathInput);
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.trim();
    if (origin.length > 0) {
      return buildAbsoluteBookingSessionRoomUrl(origin, pathInput);
    }
  }
  return buildBookingSessionRoomPath(pathInput);
}

export type ResolveBookingJoinLinkInput = {
  readonly useSessionRoomLinks: boolean;
  readonly bookingReference: string;
  readonly meetingUrl?: string | null;
  readonly siteOrigin?: string | null;
  readonly accessToken?: string | null;
};

/**
 * Calendar location for a booking — session room or direct video URL depending on admin setting.
 */
export function resolveBookingJoinCalendarLocation(input: ResolveBookingJoinLinkInput): string | undefined {
  if (input.useSessionRoomLinks) {
    return resolveBookingSessionRoomCalendarLocation(
      input.bookingReference,
      input.siteOrigin,
      input.accessToken,
    );
  }
  const meetingUrl = input.meetingUrl?.trim() ?? '';
  return meetingUrl.length > 0 ? meetingUrl : undefined;
}

/**
 * Primary join URL for emails and prominent CTAs.
 */
export function resolveBookingJoinPrimaryUrl(input: ResolveBookingJoinLinkInput & { readonly siteOrigin: string }): string {
  if (input.useSessionRoomLinks) {
    const origin = input.siteOrigin.trim().replace(/\/$/, '');
    const pathInput: BuildBookingSessionRoomPathInput = {
      bookingReference: input.bookingReference,
      accessToken: input.accessToken,
    };
    if (origin.length > 0) {
      return buildAbsoluteBookingSessionRoomUrl(origin, pathInput);
    }
    return buildBookingSessionRoomPath(pathInput);
  }
  return input.meetingUrl?.trim() ?? '';
}

/**
 * In-app href for session room entry (relative path). Returns null when session room links are disabled.
 */
export function resolveBookingSessionRoomHref(
  bookingReference: string,
  useSessionRoomLinks: boolean,
): string | null {
  if (!useSessionRoomLinks) {
    return null;
  }
  return buildBookingSessionRoomPath({ bookingReference });
}
