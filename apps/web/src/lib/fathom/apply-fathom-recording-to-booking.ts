import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument } from '@/domain/types';
import type { FathomMatchStatus } from '@/domain/recording-types';
import { getDb } from '@/lib/mongodb';
import type { ParsedFathomWebhook } from '@/lib/fathom/parse-fathom-webhook-payload';

export async function applyFathomRecordingToBooking(input: {
  readonly bookingId: string;
  readonly parsed: ParsedFathomWebhook;
  readonly matchStatus: FathomMatchStatus;
  /** When true, marks the consultation session completed (e.g. Fathom webhook after call ends). */
  readonly markSessionCompleted?: boolean;
}): Promise<boolean> {
  if (!process.env.MONGODB_URI) {
    return false;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(input.bookingId);
  } catch {
    return false;
  }
  const now = new Date();
  const setDoc: Partial<BookingDocument> = {
    fathomRecordingId: input.parsed.recordingId,
    fathomMatchStatus: input.matchStatus,
    fathomProcessedAt: now,
    updatedAt: now,
  };
  if (input.parsed.shareUrl.length > 0) {
    setDoc.fathomShareUrl = input.parsed.shareUrl;
  }
  if (input.parsed.summary.length > 0) {
    setDoc.fathomSummary = input.parsed.summary;
  }
  if (input.parsed.actionItems.length > 0) {
    setDoc.fathomActionItems = [...input.parsed.actionItems];
  }
  if (input.markSessionCompleted !== false) {
    setDoc.status = 'completed';
  }
  const db = await getDb();
  const result = await db.collection<BookingDocument>(COLLECTIONS.bookings).updateOne({ _id: objectId }, { $set: setDoc });
  return result.matchedCount > 0;
}
