import { COLLECTIONS } from '@/domain/collections';
import type {
  BookingDocument,
  LeadDocument,
  QuizAuditDocument,
  QuizSessionDocument,
  RecommendationDocument,
  VisitorSessionDocument,
} from '@/domain/types';
import { getDb } from '@/lib/mongodb';

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

/**
 * Reassigns persisted marketing data from an anonymous visitor id to a signed-in account key.
 * No-ops when the source is missing, equals the target, or already represents an account id.
 */
export async function mergeVisitorIdentityIntoAccount(params: {
  readonly fromVisitorId: string | null;
  readonly toAccountVisitorId: string;
}): Promise<void> {
  const fromVisitorId = params.fromVisitorId;
  if (!hasMongoUri() || fromVisitorId === null || fromVisitorId.length === 0) {
    return;
  }
  if (fromVisitorId === params.toAccountVisitorId || fromVisitorId.startsWith('acct:')) {
    return;
  }
  const db = await getDb();
  const filter = { visitorId: fromVisitorId };
  const update = { $set: { visitorId: params.toAccountVisitorId } };
  await Promise.all([
    db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).updateMany(filter, update),
    db.collection<QuizAuditDocument>(COLLECTIONS.quizAudit).updateMany(filter, update),
    db.collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions).updateMany(filter, update),
    db.collection<LeadDocument>(COLLECTIONS.leads).updateMany(filter, update),
    db.collection<BookingDocument>(COLLECTIONS.bookings).updateMany(filter, update),
    db.collection<RecommendationDocument>(COLLECTIONS.recommendations).updateMany(filter, update),
  ]);
}
