/**
 * Builds the marketing session room URL, optionally pre-filling the booking reference.
 */
export function buildBookingSessionRoomPath(bookingReference?: string | null): string {
  const trimmed = bookingReference?.trim() ?? '';
  if (trimmed.length === 0) {
    return '/book/session';
  }
  const params = new URLSearchParams({ bookingReference: trimmed });
  return `/book/session?${params.toString()}`;
}

/**
 * Absolute session room URL for emails and calendar location fields.
 */
export function buildAbsoluteBookingSessionRoomUrl(
  siteOrigin: string,
  bookingReference: string,
): string {
  const origin = siteOrigin.trim().replace(/\/$/, '');
  if (origin.length === 0) {
    return buildBookingSessionRoomPath(bookingReference);
  }
  return `${origin}${buildBookingSessionRoomPath(bookingReference)}`;
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
): string {
  const trimmedOrigin = siteOrigin?.trim().replace(/\/$/, '') ?? '';
  if (trimmedOrigin.length > 0) {
    return buildAbsoluteBookingSessionRoomUrl(trimmedOrigin, bookingReference);
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.trim();
    if (origin.length > 0) {
      return buildAbsoluteBookingSessionRoomUrl(origin, bookingReference);
    }
  }
  return buildBookingSessionRoomPath(bookingReference);
}

export type ResolveBookingJoinLinkInput = {
  readonly useSessionRoomLinks: boolean;
  readonly bookingReference: string;
  readonly meetingUrl?: string | null;
  readonly siteOrigin?: string | null;
};

/**
 * Calendar location for a booking — session room or direct video URL depending on admin setting.
 */
export function resolveBookingJoinCalendarLocation(input: ResolveBookingJoinLinkInput): string | undefined {
  if (input.useSessionRoomLinks) {
    return resolveBookingSessionRoomCalendarLocation(input.bookingReference, input.siteOrigin);
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
    if (origin.length > 0) {
      return buildAbsoluteBookingSessionRoomUrl(origin, input.bookingReference);
    }
    return buildBookingSessionRoomPath(input.bookingReference);
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
  return buildBookingSessionRoomPath(bookingReference);
}
