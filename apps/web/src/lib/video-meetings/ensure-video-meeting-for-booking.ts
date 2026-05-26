import type { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { resolveBookingAttendeeContact } from '@/lib/booking/resolve-booking-attendee-contact';
import { findBookingById } from '@/lib/data/bookings';
import { findLeadById } from '@/lib/data/leads';
import { resolveVideoMeetingCreationContext } from '@/lib/data/meeting-settings';
import { findPaymentTransactionById } from '@/lib/data/payment-transactions';
import { getCatalogServiceByKey } from '@/lib/data/public-catalog-services';
import {
  fetchGoogleAccessTokenFromRefresh,
  requestCreateGoogleCalendarEventWithMeet,
} from '@/lib/google-meet/google-calendar-meet-api';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import {
  fetchMicrosoftGraphAppAccessToken,
  requestCreateMicrosoftTeamsOnlineMeeting,
} from '@/lib/microsoft-teams/microsoft-graph-teams-meetings-api';
import { SITE_NAME } from '@/lib/seo/site-seo';
import { getDb } from '@/lib/mongodb';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import { fetchZoomAccessToken, requestCreateZoomScheduledMeeting } from '@/lib/zoom/zoom-api';

const DEFAULT_MEETING_DURATION_MINUTES = 60 as const;

function formatServiceKeyLabel(serviceKey: string): string {
  const parts = serviceKey.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return 'Consultation';
  }
  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function resolveMeetingTopic(serviceKey: string): string {
  if (serviceKey === 'project-rescue') {
    return `${PROJECT_RESCUE_SERVICE_TITLE} consultation`;
  }
  return `Consultation · ${serviceKey}`;
}

function resolveGoogleCalendarMeetingTopic(serviceTitle: string, bookingReference: string): string {
  return `${SITE_NAME} · ${serviceTitle} — ${bookingReference}`;
}

function resolveAbsoluteSiteOrigin(): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  if (fromPublic.length > 0) {
    return fromPublic.replace(/\/$/, '');
  }
  const vercel = process.env.VERCEL_URL?.trim() ?? '';
  if (vercel.length === 0) {
    return '';
  }
  if (vercel.startsWith('http://') || vercel.startsWith('https://')) {
    return vercel.replace(/\/$/, '');
  }
  return `https://${vercel.replace(/\/$/, '')}`;
}

async function buildGoogleCalendarEventCopy(input: {
  readonly bookingId: string;
  readonly serviceKey: string;
}): Promise<{ readonly topic: string; readonly description: string }> {
  const bookingReference = formatBookingReferenceId(input.bookingId);
  const catalogRow = await getCatalogServiceByKey(input.serviceKey);
  const serviceTitle = catalogRow?.title ?? formatServiceKeyLabel(input.serviceKey);
  const topic = resolveGoogleCalendarMeetingTopic(serviceTitle, bookingReference);
  const manageBookingEnabled = await readManageBookingEnabled();
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const manageLine =
    manageBookingEnabled && siteOrigin.length > 0
      ? `Manage booking: ${siteOrigin}/book/manage`
      : `Booking reference ${bookingReference}.`;
  const description = [`${SITE_NAME} consultation`, `Reference: ${bookingReference}`, manageLine].join('\n');
  return { topic, description };
}

function hasExistingVideoArtifacts(booking: {
  readonly meetingUrl?: string;
  readonly zoomMeetingId?: string;
  readonly googleMeetEventId?: string;
  readonly teamsOnlineMeetingId?: string;
}): boolean {
  if ((booking.meetingUrl?.trim() ?? '').length > 0) {
    return true;
  }
  if ((booking.zoomMeetingId?.trim() ?? '').length > 0) {
    return true;
  }
  if ((booking.googleMeetEventId?.trim() ?? '').length > 0) {
    return true;
  }
  if ((booking.teamsOnlineMeetingId?.trim() ?? '').length > 0) {
    return true;
  }
  return false;
}

/**
 * After a booking is confirmed and paid, creates a video meeting with the configured provider
 * and persists {@link BookingDocument.meetingUrl} (and provider-specific ids when applicable).
 */
export async function ensureVideoMeetingStoredForBooking(bookingId: ObjectId): Promise<void> {
  try {
    const context = await resolveVideoMeetingCreationContext();
    if (context === null) {
      console.warn(
        '[video-meeting] skipped provisioning: no active provider credentials (e.g. set Active provider to Google Meet and save, or configure Zoom env when Active is None).',
        { bookingId: bookingId.toHexString() },
      );
      return;
    }
    const booking = await findBookingById(bookingId.toHexString());
    if (booking === null || booking.status !== 'confirmed') {
      return;
    }
    if (hasExistingVideoArtifacts(booking)) {
      return;
    }
    const startsAt = new Date(booking.startsAtIso);
    if (Number.isNaN(startsAt.getTime())) {
      console.error('[video-meeting] invalid startsAt on booking', booking.id);
      return;
    }
    const topic = resolveMeetingTopic(booking.serviceKey);
    const timeZone = booking.timezone.trim().length > 0 ? booking.timezone : 'UTC';
    const db = await getDb();
    const setDoc: Record<string, string | Date> = { updatedAt: new Date() };
    if (context.provider === 'zoom') {
      const accessToken = await fetchZoomAccessToken(context.zoom);
      if (accessToken === null) {
        return;
      }
      const created = await requestCreateZoomScheduledMeeting(accessToken, context.zoom, {
        topic,
        startsAt,
        durationMinutes: DEFAULT_MEETING_DURATION_MINUTES,
        timezone: timeZone,
      });
      if (created === null) {
        return;
      }
      setDoc.meetingUrl = created.joinUrl;
      if (created.meetingId.length > 0) {
        setDoc.zoomMeetingId = created.meetingId;
      }
    } else if (context.provider === 'googleMeet') {
      const tokenResult = await fetchGoogleAccessTokenFromRefresh(context.googleMeet);
      if (!tokenResult.ok) {
        console.error('[google-meet] refresh failed for booking', tokenResult.failureDetail);
        return;
      }
      const lead = await findLeadById(booking.leadId);
      const transaction =
        booking.paymentTransactionId !== null
          ? await findPaymentTransactionById(booking.paymentTransactionId)
          : null;
      const attendee = resolveBookingAttendeeContact({ lead, transaction });
      if (attendee === null) {
        console.warn('[google-meet] no valid customer email; calendar invite will not be emailed', {
          bookingId: bookingId.toHexString(),
        });
      }
      const calendarCopy = await buildGoogleCalendarEventCopy({
        bookingId: booking.id,
        serviceKey: booking.serviceKey,
      });
      const created = await requestCreateGoogleCalendarEventWithMeet(tokenResult.accessToken, context.googleMeet, {
        topic: calendarCopy.topic,
        description: calendarCopy.description,
        startsAt,
        durationMinutes: DEFAULT_MEETING_DURATION_MINUTES,
        timeZone,
        attendees: attendee !== null ? [attendee] : undefined,
      });
      if (created === null) {
        console.error(
          '[google-meet] calendar event with Meet was not created; check server logs above for Calendar API error, scopes, and domain Meet policy.',
          { bookingId: bookingId.toHexString() },
        );
        return;
      }
      setDoc.meetingUrl = created.joinUrl;
      setDoc.googleMeetEventId = created.eventId;
    } else {
      const accessToken = await fetchMicrosoftGraphAppAccessToken(context.microsoftTeams);
      if (accessToken === null) {
        return;
      }
      const created = await requestCreateMicrosoftTeamsOnlineMeeting(accessToken, context.microsoftTeams, {
        topic,
        startsAt,
        durationMinutes: DEFAULT_MEETING_DURATION_MINUTES,
      });
      if (created === null) {
        return;
      }
      setDoc.meetingUrl = created.joinUrl;
      if (created.meetingId.length > 0) {
        setDoc.teamsOnlineMeetingId = created.meetingId;
      }
    }
    await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne({ _id: bookingId }, { $set: setDoc });
  } catch (error: unknown) {
    console.error('[video-meeting] ensureVideoMeetingStoredForBooking', error);
  }
}
