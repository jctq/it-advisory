import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addReporterReplyToSupportReport } from '@/lib/data/support-reports';
import { SupportReportReporterReplyThrottledError } from '@/lib/data/support-report-reporter-reply-policy';
import { getSupportSettings } from '@/lib/data/support-settings';
import { executeSendSupportReportStaffFollowUpEmail } from '@/lib/email/execute-support-report-emails';
import { assertSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  message: z.string().min(1).max(5000),
});

type RouteContext = {
  readonly params: Promise<{ readonly reportId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const disabledResponse = await assertSupportModuleEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const { reportId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const settings = await getSupportSettings();
    const result = await addReporterReplyToSupportReport({
      reportId,
      userId: user.id,
      email: user.email,
      message: parsed.data.message,
      settings,
    });
    if (result === null) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }
    const latestReply = result.report.replies[result.report.replies.length - 1];
    if (latestReply !== undefined && !latestReply.isStaffReply) {
      await executeSendSupportReportStaffFollowUpEmail({
        report: result.report,
        followUpMessage: latestReply.message,
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, report: result.report, replyPolicy: result.replyPolicy });
  } catch (error: unknown) {
    if (error instanceof SupportReportReporterReplyThrottledError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'rate_limited',
          retryAfterSeconds: error.retryAfterSeconds,
          replyPolicy: error.policy,
        },
        { status: 429 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('at least') || message.includes('at most') || message.includes('required') ? 400 : 500;
    return NextResponse.json({ error: 'Failed to send follow-up.', details: message }, { status });
  }
}
