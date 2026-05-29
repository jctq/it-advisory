export type BookingSessionDisplayTitles = {
  readonly sessionTitle: string | null;
  readonly serviceTitle: string;
};

/**
 * Primary session room headline — generated title when available, otherwise service name.
 */
export function resolveBookingSessionRoomHeadline(titles: BookingSessionDisplayTitles): string {
  const generated = titles.sessionTitle?.trim() ?? '';
  if (generated.length > 0) {
    return generated;
  }
  return titles.serviceTitle;
}

/**
 * Whether the service label should appear as secondary copy under the headline.
 */
export function shouldShowBookingSessionServiceSubtitle(titles: BookingSessionDisplayTitles): boolean {
  const generated = titles.sessionTitle?.trim() ?? '';
  return generated.length > 0 && generated !== titles.serviceTitle.trim();
}
