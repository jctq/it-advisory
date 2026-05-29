import { COLLECTIONS } from '@/domain/collections';
import type { FathomWebhookDeliveryDocument } from '@/domain/recording-types';
import { applyFathomRecordingToBooking } from '@/lib/fathom/apply-fathom-recording-to-booking';
import { fetchFathomRecordingSummary } from '@/lib/fathom/fetch-fathom-recording';
import { matchFathomRecordingToBooking } from '@/lib/fathom/match-fathom-recording-to-booking';
import { parseFathomWebhookPayload } from '@/lib/fathom/parse-fathom-webhook-payload';
import { verifyFathomWebhook } from '@/lib/fathom/verify-fathom-webhook';
import { findBookingById } from '@/lib/data/bookings';
import { getRecordingSettings, resolveFathomCredentialsForRuntime } from '@/lib/data/recording-settings';
import { executeSendBookingFathomNotesEmail } from '@/lib/email/send-booking-fathom-notes-email';
import { getDb } from '@/lib/mongodb';

export type ProcessFathomWebhookResult = {
  readonly handled: boolean;
  readonly status: number;
};

async function insertWebhookDelivery(doc: FathomWebhookDeliveryDocument): Promise<boolean> {
  const db = await getDb();
  try {
    await db.collection<FathomWebhookDeliveryDocument>(COLLECTIONS.fathomWebhookDeliveries).insertOne(doc);
    return true;
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: number }).code : 0;
    if (code === 11000) {
      return false;
    }
    throw error;
  }
}

export async function processFathomWebhook(input: {
  readonly bodyText: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}): Promise<ProcessFathomWebhookResult> {
  if (process.env.FATHOM_ENABLED === '0') {
    return { handled: true, status: 200 };
  }
  const settings = await getRecordingSettings();
  if (!settings.recordingsEnabled || settings.activeProvider !== 'fathom') {
    return { handled: true, status: 200 };
  }
  const credentials = await resolveFathomCredentialsForRuntime();
  if (credentials === null) {
    console.warn('[fathom-webhook] skipped: credentials not configured');
    return { handled: false, status: 503 };
  }
  if (!verifyFathomWebhook({ webhookSecret: credentials.webhookSecret, headers: input.headers, rawBody: input.bodyText })) {
    return { handled: false, status: 401 };
  }
  const webhookId = input.headers['webhook-id']?.trim() ?? '';
  if (webhookId.length === 0) {
    return { handled: false, status: 400 };
  }
  let json: unknown;
  try {
    json = JSON.parse(input.bodyText) as unknown;
  } catch {
    return { handled: false, status: 400 };
  }
  const parsed = parseFathomWebhookPayload(json);
  if (parsed === null) {
    return { handled: false, status: 400 };
  }
  const inserted = await insertWebhookDelivery({
    webhookId,
    receivedAt: new Date(),
    fathomRecordingId: parsed.recordingId,
    matchStatus: 'unmatched',
    rawPayloadSnippet: input.bodyText.slice(0, 2000),
  });
  if (!inserted) {
    return { handled: true, status: 200 };
  }
  let enriched = parsed;
  if (enriched.summary.length === 0) {
    const fetched = await fetchFathomRecordingSummary({
      credentials,
      recordingId: enriched.recordingId,
    });
    if (fetched !== null && fetched.summary.length > 0) {
      enriched = { ...enriched, summary: fetched.summary };
    }
  }
  const match = await matchFathomRecordingToBooking({
    parsed: enriched,
    hostEmail: credentials.hostEmail,
  });
  if (match.status === 'unmatched') {
    return { handled: true, status: 200 };
  }
  if (match.status === 'ambiguous') {
    const db = await getDb();
    await db.collection<FathomWebhookDeliveryDocument>(COLLECTIONS.fathomWebhookDeliveries).updateOne(
      { webhookId },
      { $set: { matchStatus: 'ambiguous' } },
    );
    return { handled: true, status: 200 };
  }
  const applied = await applyFathomRecordingToBooking({
    bookingId: match.bookingId,
    parsed: enriched,
    matchStatus: 'linked',
    markSessionCompleted: true,
  });
  if (!applied) {
    return { handled: true, status: 200 };
  }
  const db = await getDb();
  await db.collection<FathomWebhookDeliveryDocument>(COLLECTIONS.fathomWebhookDeliveries).updateOne(
    { webhookId },
    { $set: { bookingId: match.bookingId, matchStatus: 'linked' } },
  );
  const linkedBooking = await findBookingById(match.bookingId);
  const notesEmailAlreadySent =
    linkedBooking?.fathomNotesEmailSentAtIso !== null && linkedBooking?.fathomNotesEmailSentAtIso !== undefined;
  if (!notesEmailAlreadySent) {
    await executeSendBookingFathomNotesEmail({ bookingId: match.bookingId });
  }
  return { handled: true, status: 200 };
}
