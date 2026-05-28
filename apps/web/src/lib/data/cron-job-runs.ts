import { ObjectId, type Filter } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { CronJobId, CronJobRunDocument, CronRunStatus, CronTriggerSource } from '@/domain/cron-types';
import type { AdminPaginatedList } from '@/lib/admin/admin-paginated-list';
import { getDb } from '@/lib/mongodb';

const DEFAULT_CRON_RUN_LIST_LIMIT = 100 as const;

export type CronJobRunListStatusFilter = CronRunStatus | 'all';

export type CronJobRunListJobFilter = CronJobId | 'all';

export type CronJobRunAdminPage = AdminPaginatedList<CronJobRunAdminRow>;

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

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCronJobRunListFilter(input: {
  readonly status: CronJobRunListStatusFilter;
  readonly jobId: CronJobRunListJobFilter;
  readonly search: string;
}): Filter<CronJobRunDocument> {
  const filters: Filter<CronJobRunDocument>[] = [];
  if (input.status !== 'all') {
    filters.push({ status: input.status });
  }
  if (input.jobId !== 'all') {
    filters.push({ jobId: input.jobId });
  }
  const trimmedSearch = input.search.trim();
  if (trimmedSearch.length > 0) {
    const escapedSearch = escapeRegexLiteral(trimmedSearch);
    const searchRegex = { $regex: escapedSearch, $options: 'i' };
    filters.push({
      $or: [{ jobId: searchRegex }, { errorMessage: searchRegex }],
    });
  }
  if (filters.length === 0) {
    return {};
  }
  if (filters.length === 1) {
    return filters[0]!;
  }
  return { $and: filters };
}

export async function listCronJobRunsForAdmin(
  limit: number = DEFAULT_CRON_RUN_LIST_LIMIT,
): Promise<readonly CronJobRunAdminRow[]> {
  const page = await listCronJobRunsForAdminPage({ page: 1, pageSize: limit });
  return page.rows;
}

export async function listCronJobRunsForAdminPage(input: {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: CronJobRunListStatusFilter;
  readonly jobId?: CronJobRunListJobFilter;
  readonly search?: string;
}): Promise<CronJobRunAdminPage> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const status = input.status ?? 'all';
  const jobId = input.jobId ?? 'all';
  const search = input.search?.trim() ?? '';
  const filter = buildCronJobRunListFilter({ status, jobId, search });
  const db = await getDb();
  const collection = db.collection<CronJobRunDocument>(COLLECTIONS.cronJobRuns);
  const [totalCount, docs] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);
  const rows = docs
    .filter((doc): doc is CronJobRunDocument & { _id: ObjectId } => doc._id !== undefined)
    .map(mapCronJobRun);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}
