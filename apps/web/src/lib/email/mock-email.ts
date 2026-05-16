import { COLLECTIONS } from '@/domain/collections';
import { getDb } from '@/lib/mongodb';
import type { EmailSendDocument } from '@/domain/types';

/**
 * Persists a mock "sent" email for audit. Prefer {@link executeSendBookingConfirmationEmail} for booking flows.
 */
export async function sendMockEmail(
  to: string,
  templateKey: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<{ id: string }> {
  const db = await getDb();
  const doc: EmailSendDocument = {
    to,
    templateKey,
    payload,
    status: 'mock_sent',
    createdAt: new Date(),
  };
  const result = await db.collection<EmailSendDocument>(COLLECTIONS.emailSends).insertOne(doc);
  return { id: result.insertedId.toString() };
}
