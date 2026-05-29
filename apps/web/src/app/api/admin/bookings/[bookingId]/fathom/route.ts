import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyFathomRecordingToBooking } from '@/lib/fathom/apply-fathom-recording-to-booking';
import { fetchFathomRecordingSummary } from '@/lib/fathom/fetch-fathom-recording';
import { parseFathomWebhookPayload } from '@/lib/fathom/parse-fathom-webhook-payload';
import { findBookingById } from '@/lib/data/bookings';
import { resolveFathomCredentialsForRuntime } from '@/lib/data/recording-settings';
import { executeSendBookingFathomNotesEmail } from '@/lib/email/send-booking-fathom-notes-email';

const patchSchema = z.object({
  fathomRecordingId: z.string().min(1).max(120).optional(),
  fathomShareUrl: z.string().url().max(2000).optional(),
  sendCustomerEmail: z.boolean().optional(),
});

type RouteContext = {
  readonly params: Promise<{ readonly bookingId: string }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { bookingId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const booking = await findBookingById(bookingId);
  if (booking === null) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  const recordingId = parsed.data.fathomRecordingId?.trim() ?? booking.fathomRecordingId?.trim() ?? '';
  const shareUrl = parsed.data.fathomShareUrl?.trim() ?? booking.fathomShareUrl?.trim() ?? '';
  if (recordingId.length === 0 && shareUrl.length === 0) {
    return NextResponse.json({ error: 'Provide fathomRecordingId or fathomShareUrl' }, { status: 400 });
  }
  const credentials = await resolveFathomCredentialsForRuntime();
  let summary = booking.fathomSummary ?? '';
  if (recordingId.length > 0 && credentials !== null && summary.trim().length === 0) {
    const fetched = await fetchFathomRecordingSummary({ credentials, recordingId });
    if (fetched !== null && fetched.summary.length > 0) {
      summary = fetched.summary;
    }
  }
  const parsedRecording = parseFathomWebhookPayload({
    recording_id: recordingId.length > 0 ? recordingId : 'manual',
    title: '',
    share_url: shareUrl,
    summary,
  });
  if (parsedRecording === null) {
    return NextResponse.json({ error: 'Could not parse recording payload' }, { status: 400 });
  }
  const applied = await applyFathomRecordingToBooking({
    bookingId: booking.id,
    parsed: parsedRecording,
    matchStatus: 'manual',
    markSessionCompleted: false,
  });
  if (!applied) {
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
  if (parsed.data.sendCustomerEmail === true) {
    await executeSendBookingFathomNotesEmail({ bookingId: booking.id });
  }
  const updated = await findBookingById(bookingId);
  return NextResponse.json({ ok: true, booking: updated });
}
