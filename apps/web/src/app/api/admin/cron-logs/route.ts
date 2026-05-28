import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CRON_JOB_IDS, CRON_RUN_STATUSES } from '@/domain/cron-types';
import { listCronJobRunsForAdminPage } from '@/lib/data/cron-job-runs';

export const dynamic = 'force-dynamic';

const statusFilterSchema = z.enum(['all', ...CRON_RUN_STATUSES]);

const jobFilterSchema = z.enum(['all', ...CRON_JOB_IDS]);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().max(200).optional(),
  status: statusFilterSchema.optional(),
  jobId: jobFilterSchema.optional(),
});

/**
 * GET /api/admin/cron-logs — paginated cron job run list for admin debug.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    jobId: url.searchParams.get('jobId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await listCronJobRunsForAdminPage({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.q,
      status: parsed.data.status,
      jobId: parsed.data.jobId,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load cron logs.', details: message }, { status: 500 });
  }
}
