import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addStaffReplyToSupportReport } from '@/lib/data/support-reports';
import { resolveSupportNotificationEmails } from '@/lib/data/support-settings';
import { executeSendSupportReportReporterReplyEmail } from '@/lib/email/execute-support-report-emails';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  message: z.string().min(1).max(5000),
});

type RouteContext = {
  readonly params: Promise<{ readonly reportId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
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
    const staffEmails = await resolveSupportNotificationEmails();
    const staffEmail = staffEmails[0] ?? 'support@noreply.local';
    const report = await addStaffReplyToSupportReport({
      reportId,
      message: parsed.data.message,
      staffEmail,
    });
    if (report === null) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }
    const latestReply = report.replies[report.replies.length - 1];
    if (latestReply !== undefined) {
      await executeSendSupportReportReporterReplyEmail({
        report,
        replyMessage: latestReply.message,
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('at least') || message.includes('at most') || message.includes('required') ? 400 : 500;
    return NextResponse.json({ error: 'Failed to send reply.', details: message }, { status });
  }
}
