/** Known scheduled jobs — extend when adding `/api/cron/*` routes. */
export const CRON_JOB_IDS = ['payment-holds'] as const;

export type CronJobId = (typeof CRON_JOB_IDS)[number];

export const CRON_RUN_STATUSES = ['running', 'success', 'error', 'unauthorized'] as const;

export type CronRunStatus = (typeof CRON_RUN_STATUSES)[number];

export const CRON_TRIGGER_SOURCES = ['scheduled', 'manual', 'unknown'] as const;

export type CronTriggerSource = (typeof CRON_TRIGGER_SOURCES)[number];

/** Append-only execution log for `/api/cron/*` handlers (admin visibility). */
export type CronJobRunDocument = {
  readonly jobId: CronJobId;
  readonly startedAt: Date;
  readonly finishedAt?: Date;
  readonly durationMs?: number;
  readonly status: CronRunStatus;
  readonly triggerSource: CronTriggerSource;
  readonly result?: Record<string, unknown>;
  readonly errorMessage?: string;
};
