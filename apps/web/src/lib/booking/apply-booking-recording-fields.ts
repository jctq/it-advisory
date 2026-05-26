import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import { getRecordingSettings } from '@/lib/data/recording-settings';
import { getDb } from '@/lib/mongodb';

export async function applyBookingRecordingFieldsFromCheckout(input: {
  readonly bookingId: ObjectId;
  readonly recordingOptIn: boolean;
}): Promise<void> {
  if (!process.env.MONGODB_URI) {
    return;
  }
  const settings = await getRecordingSettings();
  const recordingOptIn = settings.recordingsEnabled && input.recordingOptIn;
  const snapshotPrice = recordingOptIn ? settings.recordingOptInPriceCentavos : 0;
  const db = await getDb();
  await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne(
    { _id: input.bookingId },
    {
      $set: {
        recordingOptIn,
        recordingOptInPriceCentavos: snapshotPrice,
        fathomMatchStatus: recordingOptIn ? 'pending' : 'skipped',
        updatedAt: new Date(),
      },
    },
  );
}

export function parseRecordingOptInFromTransactionMetadata(
  metadata: Record<string, string> | undefined,
): boolean {
  if (metadata === undefined) {
    return false;
  }
  const raw = metadata.recordingOptIn?.trim().toLowerCase() ?? '';
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Applies recording opt-in from checkout transaction metadata to an existing booking row. */
export async function syncBookingRecordingFieldsFromTransaction(input: {
  readonly bookingId: ObjectId;
  readonly metadata: Record<string, string> | undefined;
}): Promise<void> {
  await applyBookingRecordingFieldsFromCheckout({
    bookingId: input.bookingId,
    recordingOptIn: parseRecordingOptInFromTransactionMetadata(input.metadata),
  });
}
