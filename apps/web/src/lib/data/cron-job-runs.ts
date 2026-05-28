import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { CronJobId, CronJobRunDocument, CronRunStatus, CronTriggerSource } from '@/domain/cron-types';
import { getDb } from '@/lib/mongodb';

const DEFAULT_CRON_RUN_LIST_LIMIT = 100 as const;

export type CronJobRunAdminRow = {
  readonly id: string;
  readonly jobId: CronJobId;
  readonly jobLabel: string;
  readonly startedAtIso: string;
  readonly finishedAtIso: string | null;
  readonly durationMs: number | null;
  readonly status: CronRunStatus;
  readonly triggerSource: CronTriggerSource;
  readonly result: Record<string, unknown> | null;
  readonly errorMessage: string | null;
};

const CRON_JOB_LABELS: Record<CronJobId, string> = {
  'payment-holds': 'Payment holds',
};

function mapCronJobRun(
  doc: CronJobRunDocument & { _id: ObjectId },
): CronJobRunAdminRow {
  return {
    id: doc._id.toString(),
    jobId: doc.jobId,
    jobLabel: CRON_JOB_LABELS[doc.jobId] ?? doc.jobId,
    startedAtIso: doc.startedAt.toISOString(),
    finishedAtIso: doc.finishedAt !== undefined ? doc.finishedAt.toISOString() : null,
    durationMs: doc.durationMs ?? null,
    status: doc.status,
    triggerSource: doc.triggerSource,
    result: doc.result ?? null,
    errorMessage: doc.errorMessage ?? null,
  };
}

export async function listCronJobRunsForAdmin(
  limit: number = DEFAULT_CRON_RUN_LIST_LIMIT,
): Promise<readonly CronJobRunAdminRow[]> {
  const db = await getDb();
  const docs = await db
    .collection<CronJobRunDocument>(COLLECTIONS.cronJobRuns)
    .find({})
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
  return docs
    .filter((doc): doc is CronJobRunDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapCronJobRun);
}
