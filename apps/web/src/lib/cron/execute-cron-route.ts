import { NextResponse } from 'next/server';
import type { CronJobId } from '@/domain/cron-types';
import { finalizeCronJobRun, insertCronJobRun } from '@/lib/cron/record-cron-job-run';
import { resolveCronTriggerSource, verifyCronRequest } from '@/lib/cron/verify-cron-request';

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Cron job failed';
}

export async function executeCronRoute(input: {
  readonly request: Request;
  readonly jobId: CronJobId;
  readonly handler: () => Promise<Record<string, unknown>>;
}): Promise<NextResponse> {
  const triggerSource = resolveCronTriggerSource(input.request);
  const auth = verifyCronRequest(input.request);
  const runId = await insertCronJobRun({
    jobId: input.jobId,
    status: auth.authorized ? 'running' : 'unauthorized',
    triggerSource,
  });
  if (!auth.authorized) {
    await finalizeCronJobRun({ runId, status: 'unauthorized' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await input.handler();
    await finalizeCronJobRun({ runId, status: 'success', result });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const errorMessage = resolveErrorMessage(error);
    console.error(`[cron:${input.jobId}]`, error);
    await finalizeCronJobRun({ runId, status: 'error', errorMessage });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
