import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type {
  QuizAnswers,
  QuizAuditDocument,
  QuizSessionDocument,
  VisitorSessionDocument,
} from '@/domain/types';
import { extractGuidedDiagnosticRawFromQuizAnswers } from '@/lib/marketing/extract-guided-diagnostic-raw';
import { getDb } from '@/lib/mongodb';

const DEFAULT_QUIZ_SESSION_LIST_LIMIT = 500;
const DEFAULT_QUIZ_AUDIT_LIST_LIMIT = 200;
const SITUATION_PREVIEW_MAX_LENGTH = 120;

export type QuizSessionListRow = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly situationPreview: string | null;
};

export type QuizSessionDetail = {
  readonly id: string;
  readonly visitorId: string;
  readonly currentStep: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly guidedDiagnosticRaw: string | null;
  readonly situationDiagnosticThread: string | null;
};

export type QuizAuditAdminRow = {
  readonly id: string;
  readonly step: number;
  readonly createdAtIso: string;
  readonly answersJson: string;
};

function resolveSituationPreview(answers: QuizAnswers): string | null {
  const raw = answers.situation;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.length > SITUATION_PREVIEW_MAX_LENGTH
    ? `${trimmed.slice(0, SITUATION_PREVIEW_MAX_LENGTH)}…`
    : trimmed;
}

function resolveSituationDiagnosticThread(answers: QuizAnswers): string | null {
  const raw = answers.situationDiagnosticThread;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapQuizSessionListRow(
  doc: QuizSessionDocument & { _id: ObjectId },
): QuizSessionListRow {
  const guidedRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
  return {
    id: doc._id.toString(),
    visitorId: doc.visitorId,
    currentStep: doc.currentStep,
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
    hasGuidedDiagnostic: guidedRaw !== null,
    situationPreview: resolveSituationPreview(doc.answers),
  };
}

/**
 * Admin list: all persisted quiz session snapshots (latest row per visitor when upserts target the same document).
 */
export async function listQuizSessionsForAdmin(
  limit: number = DEFAULT_QUIZ_SESSION_LIST_LIMIT,
): Promise<QuizSessionListRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<QuizSessionDocument>(COLLECTIONS.quizSessions)
    .find()
    .sort({ updatedAt: -1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs
    .filter((doc): doc is QuizSessionDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapQuizSessionListRow);
}

/**
 * Admin detail: one quiz session by Mongo `_id`.
 */
export async function findQuizSessionById(sessionId: string): Promise<QuizSessionDetail | null> {
  if (!hasMongoUri()) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionId);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).findOne({ _id: objectId });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  const guidedDiagnosticRaw = extractGuidedDiagnosticRawFromQuizAnswers(doc.answers);
  return {
    id: doc._id.toString(),
    visitorId: doc.visitorId,
    currentStep: doc.currentStep,
    createdAtIso: doc.createdAt.toISOString(),
    updatedAtIso: doc.updatedAt.toISOString(),
    completedAtIso: doc.completedAt !== undefined ? doc.completedAt.toISOString() : null,
    guidedDiagnosticRaw,
    situationDiagnosticThread: resolveSituationDiagnosticThread(doc.answers),
  };
}

/**
 * Append-only save history for a session (`quiz_audit`).
 */
export async function listQuizAuditForSession(
  sessionId: ObjectId,
  limit: number = DEFAULT_QUIZ_AUDIT_LIST_LIMIT,
): Promise<QuizAuditAdminRow[]> {
  if (!hasMongoUri()) {
    return [];
  }
  const db = await getDb();
  const cursor = db
    .collection<QuizAuditDocument>(COLLECTIONS.quizAudit)
    .find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(limit);
  const docs = await cursor.toArray();
  return docs
    .filter((doc): doc is QuizAuditDocument & { _id: ObjectId } => doc._id !== undefined)
    .map((doc) => ({
      id: doc._id.toString(),
      step: doc.step,
      createdAtIso: doc.createdAt.toISOString(),
      answersJson: safeStringifyAnswers(doc.answersSnapshot),
    }));
}

function safeStringifyAnswers(answers: QuizAnswers): string {
  try {
    return JSON.stringify(answers, null, 2);
  } catch {
    return '{}';
  }
}

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
