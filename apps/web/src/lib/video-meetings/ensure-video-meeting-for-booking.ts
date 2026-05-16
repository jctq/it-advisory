import type { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { resolveVideoMeetingCreationContext } from '@/lib/data/meeting-settings';
import { getDb } from '@/lib/mongodb';
import {
  fetchGoogleAccessTokenFromRefresh,
  requestCreateGoogleCalendarEventWithMeet,
} from '@/lib/google-meet/google-calendar-meet-api';
import {
  fetchMicrosoftGraphAppAccessToken,
  requestCreateMicrosoftTeamsOnlineMeeting,
} from '@/lib/microsoft-teams/microsoft-graph-teams-meetings-api';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import { fetchZoomAccessToken, requestCreateZoomScheduledMeeting } from '@/lib/zoom/zoom-api';

const DEFAULT_MEETING_DURATION_MINUTES = 60 as const;

function resolveMeetingTopic(serviceKey: string): string {
  if (serviceKey === 'project-rescue') {
    return `${PROJECT_RESCUE_SERVICE_TITLE} consultation`;
  }
  return `Consultation · ${serviceKey}`;
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
      const created = await requestCreateGoogleCalendarEventWithMeet(tokenResult.accessToken, context.googleMeet, {
        topic,
        startsAt,
        durationMinutes: DEFAULT_MEETING_DURATION_MINUTES,
        timeZone,
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
