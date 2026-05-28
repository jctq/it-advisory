import { NextResponse } from 'next/server';
import { computeSupportReportReporterReplyPolicy } from '@/lib/data/support-report-reporter-reply-policy';
import {
  findSupportReportByIdForReporter,
  markSupportReportReadByReporter,
} from '@/lib/data/support-reports';
import { getSupportSettings } from '@/lib/data/support-settings';
import { assertSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly reportId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const disabledResponse = await assertSupportModuleEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const { reportId } = await context.params;
  try {
    const report = await findSupportReportByIdForReporter({
      reportId,
      userId: user.id,
      email: user.email,
    });
    if (report === null) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }
    await markSupportReportReadByReporter({
      reportId,
      userId: user.id,
      email: user.email,
    });
    const settings = await getSupportSettings();
    const replyPolicy = computeSupportReportReporterReplyPolicy(report, settings);
    return NextResponse.json({ report, replyPolicy });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load report.', details: message }, { status: 500 });
  }
}
