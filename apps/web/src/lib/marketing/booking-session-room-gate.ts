import { getAppSettings } from '@/lib/data/app-settings';

/**
 * When true, confirmation emails, calendar invites, and in-app join links use `/book/session`.
 * When false, direct Google Meet / Zoom / Teams links are used when available.
 */
export async function readBookingSessionRoomLinksEnabled(): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.bookingSessionRoomLinksEnabled;
}
