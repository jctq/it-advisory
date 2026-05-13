import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { QuizSessionDocument, UserAccountDocument, UserAuthSessionDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import { buildAccountVisitorId } from '@/lib/server/marketing-auth';

const DEFAULT_USER_LIST_LIMIT = 200;
const QUIZ_SNAPSHOT_LIMIT = 25;
const AUTH_SESSION_LIMIT = 50;

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export type MarketingUserListRow = {
  readonly id: string;
  readonly email: string;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type MarketingUserAuthSessionAdminRow = {
  readonly id: string;
  readonly createdAtIso: string;
  readonly expiresAtIso: string;
  readonly isExpired: boolean;
};

export type MarketingUserQuizSnapshotRow = {
  readonly id: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
};

export type MarketingUserDetail = {
  readonly id: string;
  readonly email: string;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly accountVisitorId: string;
  readonly authSessions: readonly MarketingUserAuthSessionAdminRow[];
  readonly quizSnapshots: readonly MarketingUserQuizSnapshotRow[];
};

/**
 * Admin list: marketing accounts (`users`), newest first.
 */
export async function listMarketingUsersForAdmin(
  limit: number = DEFAULT_USER_LIST_LIMIT,
): Promise<MarketingUserListRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<UserAccountDocument>(COLLECTIONS.users)
    .find()
    .sort({ createdAt: -1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs
    .filter((doc): doc is UserAccountDocument & { _id: ObjectId } => doc._id !== undefined)
    .map((doc) => ({
      id: doc._id.toHexString(),
      email: doc.emailNormalized,
      createdAtIso: doc.createdAt.toISOString(),
      updatedAtIso: doc.updatedAt.toISOString(),
    }));
}

function mapAuthSessionRow(doc: UserAuthSessionDocument & { _id: ObjectId }): MarketingUserAuthSessionAdminRow {
  const now = Date.now();
  return {
    id: doc._id.toHexString(),
    createdAtIso: doc.createdAt.toISOString(),
    expiresAtIso: doc.expiresAt.toISOString(),
    isExpired: doc.expiresAt.getTime() <= now,
  };
}

function mapQuizSnapshotRow(doc: QuizSessionDocument & { _id: ObjectId }): MarketingUserQuizSnapshotRow {
  return {
    id: doc._id.toHexString(),
    currentStep: doc.currentStep,
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
  };
}

/**
 * Admin detail: one marketing user, recent sign-in sessions, and quiz rows keyed to `acct:<userId>`.
 */
export async function findMarketingUserDetailForAdmin(userId: string): Promise<MarketingUserDetail | null> {
  if (!hasMongoUri()) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(userId);
  } catch {
    return null;
  }
  const db = await getDb();
  const userDoc = await db.collection<UserAccountDocument>(COLLECTIONS.users).findOne({ _id: objectId });
  if (userDoc === null || userDoc._id === undefined) {
    return null;
  }
  const accountVisitorId = buildAccountVisitorId(userDoc._id.toHexString());
  const [sessionDocs, quizDocs] = await Promise.all([
    db
      .collection<UserAuthSessionDocument>(COLLECTIONS.userAuthSessions)
      .find({ userId: objectId })
      .sort({ createdAt: -1 })
      .limit(AUTH_SESSION_LIMIT)
      .toArray(),
    db
      .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
      .find({ visitorId: accountVisitorId })
      .sort({ updatedAt: -1 })
      .limit(QUIZ_SNAPSHOT_LIMIT)
      .toArray(),
  ]);
  const authSessions = sessionDocs
    .filter((doc): doc is UserAuthSessionDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapAuthSessionRow);
  const quizSnapshots = quizDocs
    .filter((doc): doc is QuizSessionDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapQuizSnapshotRow);
  return {
    id: userDoc._id.toHexString(),
    email: userDoc.emailNormalized,
    createdAtIso: userDoc.createdAt.toISOString(),
    updatedAtIso: userDoc.updatedAt.toISOString(),
    accountVisitorId,
    authSessions,
    quizSnapshots,
  };
}
