import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type {
  QuizAnswers,
  QuizAuditDocument,
  QuizSessionDocument,
  VisitorSessionDocument,
} from '@/domain/types';
import { getDb } from '@/lib/mongodb';

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function findIncompleteQuizSession(visitorId: string): Promise<QuizSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .findOne({ visitorId, completedAt: { $exists: false } }, { sort: { updatedAt: -1 } });
  return doc;
}

/**
 * Latest quiz row for this visitor (complete or not). Used to restore guided diagnostic answers after finishing.
 */
export async function findLatestQuizSession(visitorId: string): Promise<QuizSessionDocument | null> {
  if (!hasMongoUri()) {
    return null;
  }
  const db = await getDb();
  return db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .findOne({ visitorId }, { sort: { updatedAt: -1 } });
}

async function insertQuizAudit(input: {
  readonly visitorId: string;
  readonly sessionId: ObjectId;
  readonly step: number;
  readonly answersSnapshot: QuizAnswers;
}): Promise<void> {
  const db = await getDb();
  const auditDoc: QuizAuditDocument = {
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    step: input.step,
    answersSnapshot: input.answersSnapshot,
    createdAt: new Date(),
  };
  await db.collection<QuizAuditDocument>(COLLECTIONS.quizAudit).insertOne(auditDoc);
}

async function upsertVisitorSessionPointer(visitorId: string, sessionId: ObjectId): Promise<void> {
  const db = await getDb();
  const doc: VisitorSessionDocument = {
    visitorId,
    latestSessionId: sessionId,
    updatedAt: new Date(),
  };
  await db.collection<VisitorSessionDocument>(COLLECTIONS.visitorSessions).updateOne(
    { visitorId },
    { $set: doc },
    { upsert: true },
  );
}

export type UpsertQuizProgressInput = {
  readonly visitorId: string;
  readonly answers: QuizAnswers;
  readonly currentStep: number;
  readonly isComplete: boolean;
};

export type UpsertQuizProgressResult = {
  readonly persisted: boolean;
  readonly sessionId?: string;
};

/**
 * Creates or updates the visitor's in-progress quiz session and writes an audit row.
 */
export async function upsertQuizProgress(input: UpsertQuizProgressInput): Promise<UpsertQuizProgressResult> {
  if (!hasMongoUri()) {
    return { persisted: false };
  }
  const db = await getDb();
  const sessions = db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions);
  const now = new Date();
  const latest = await sessions.findOne({ visitorId: input.visitorId }, { sort: { updatedAt: -1 } });
  const setFields: Record<string, unknown> = {
    answers: input.answers,
    currentStep: input.currentStep,
    updatedAt: now,
  };
  if (input.isComplete) {
    setFields.completedAt = now;
  }
  if (latest?._id) {
    if (input.isComplete) {
      await sessions.updateOne({ _id: latest._id }, { $set: setFields });
    } else {
      await sessions.updateOne(
        { _id: latest._id },
        {
          $set: setFields,
          $unset: { completedAt: '' },
        },
      );
    }
    await insertQuizAudit({
      visitorId: input.visitorId,
      sessionId: latest._id,
      step: input.currentStep,
      answersSnapshot: input.answers,
    });
    await upsertVisitorSessionPointer(input.visitorId, latest._id);
    return { persisted: true, sessionId: latest._id.toString() };
  }
  const insertDoc: Omit<QuizSessionDocument, '_id'> = {
    visitorId: input.visitorId,
    answers: input.answers,
    currentStep: input.currentStep,
    createdAt: now,
    updatedAt: now,
    ...(input.isComplete ? { completedAt: now } : {}),
  };
  const insertResult = await sessions.insertOne(insertDoc);
  await insertQuizAudit({
    visitorId: input.visitorId,
    sessionId: insertResult.insertedId,
    step: input.currentStep,
    answersSnapshot: input.answers,
  });
  await upsertVisitorSessionPointer(input.visitorId, insertResult.insertedId);
  return { persisted: true, sessionId: insertResult.insertedId.toString() };
}
