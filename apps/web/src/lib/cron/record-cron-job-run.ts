import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { CronJobId, CronJobRunDocument, CronRunStatus, CronTriggerSource } from '@/domain/cron-types';
import { getDb } from '@/lib/mongodb';

export async function insertCronJobRun(input: {
  readonly jobId: CronJobId;
  readonly status: CronRunStatus;
  readonly triggerSource: CronTriggerSource;
}): Promise<string> {
  const db = await getDb();
  const startedAt = new Date();
  const doc: CronJobRunDocument = {
    jobId: input.jobId,
    startedAt,
    status: input.status,
    triggerSource: input.triggerSource,
  };
  const result = await db.collection<CronJobRunDocument>(COLLECTIONS.cronJobRuns).insertOne(doc);
  return result.insertedId.toString();
}

export async function finalizeCronJobRun(input: {
  readonly runId: string;
  readonly status: CronRunStatus;
  readonly result?: Record<string, unknown>;
  readonly errorMessage?: string;
}): Promise<void> {
  const objectId = ObjectId.createFromHexString(input.runId);
  const db = await getDb();
  const existing = await db.collection<CronJobRunDocument>(COLLECTIONS.cronJobRuns).findOne({ _id: objectId });
  if (existing === null) {
    return;
  }
  const finishedAt = new Date();
  const durationMs = Math.max(0, finishedAt.getTime() - existing.startedAt.getTime());
  await db.collection<CronJobRunDocument>(COLLECTIONS.cronJobRuns).updateOne(
    { _id: objectId },
    {
      $set: {
        status: input.status,
        finishedAt,
        durationMs,
        ...(input.result !== undefined ? { result: input.result } : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
      },
    },
  );
}
