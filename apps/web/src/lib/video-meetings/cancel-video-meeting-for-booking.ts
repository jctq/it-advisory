import type { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { findBookingById } from '@/lib/data/bookings';
import { resolveVideoMeetingCreationContext } from '@/lib/data/meeting-settings';
import { fetchGoogleAccessTokenFromRefresh, requestDeleteGoogleCalendarEvent } from '@/lib/google-meet/google-calendar-meet-api';
import {
  fetchMicrosoftGraphAppAccessToken,
  requestDeleteMicrosoftTeamsOnlineMeeting,
} from '@/lib/microsoft-teams/microsoft-graph-teams-meetings-api';
import { getDb } from '@/lib/mongodb';
import { fetchZoomAccessToken, requestDeleteZoomMeeting } from '@/lib/zoom/zoom-api';

async function clearBookingMeetingFields(bookingId: ObjectId): Promise<void> {
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: bookingId },
    {
      $unset: {
        meetingUrl: '',
        zoomMeetingId: '',
        googleMeetEventId: '',
        teamsOnlineMeetingId: '',
      },
      $set: { updatedAt: new Date() },
    },
  );
}

/**
 * Best-effort cancellation of provider meetings linked to a booking.
 * Swallows errors so refund/cancellation flows are not blocked.
 */
export async function executeCancelVideoMeetingForBooking(bookingId: string): Promise<void> {
  try {
    const booking = await findBookingById(bookingId);
    if (booking === null) {
      return;
    }
    const zoomMeetingId = booking.zoomMeetingId?.trim() ?? '';
    const googleMeetEventId = booking.googleMeetEventId?.trim() ?? '';
    const teamsOnlineMeetingId = booking.teamsOnlineMeetingId?.trim() ?? '';
    const hasMeetingArtifacts =
      (booking.meetingUrl?.trim() ?? '').length > 0 ||
      zoomMeetingId.length > 0 ||
      googleMeetEventId.length > 0 ||
      teamsOnlineMeetingId.length > 0;
    if (!hasMeetingArtifacts) {
      return;
    }
    const context = await resolveVideoMeetingCreationContext();
    if (context !== null) {
      if (context.provider === 'zoom' && zoomMeetingId.length > 0) {
        const accessToken = await fetchZoomAccessToken(context.zoom);
        if (accessToken !== null) {
          await requestDeleteZoomMeeting(accessToken, zoomMeetingId);
        }
      } else if (context.provider === 'googleMeet' && googleMeetEventId.length > 0) {
        const tokenResult = await fetchGoogleAccessTokenFromRefresh(context.googleMeet);
        if (tokenResult.ok) {
          await requestDeleteGoogleCalendarEvent(tokenResult.accessToken, context.googleMeet, googleMeetEventId);
        }
      } else if (context.provider === 'microsoftTeams' && teamsOnlineMeetingId.length > 0) {
        const accessToken = await fetchMicrosoftGraphAppAccessToken(context.microsoftTeams);
        if (accessToken !== null) {
          await requestDeleteMicrosoftTeamsOnlineMeeting(accessToken, context.microsoftTeams, teamsOnlineMeetingId);
        }
      }
    }
    const { ObjectId: MongoObjectId } = await import('mongodb');
    await clearBookingMeetingFields(new MongoObjectId(bookingId));
  } catch (error: unknown) {
    console.error('[video-meeting] executeCancelVideoMeetingForBooking', error);
  }
}
