import { NextResponse } from 'next/server';
import { isSupportReportOwnedByReporter, readSupportReportScreenshotBuffer } from '@/lib/data/support-reports';
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
  const isOwned = await isSupportReportOwnedByReporter({
    reportId,
    userId: user.id,
    email: user.email,
  });
  if (!isOwned) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  const screenshot = await readSupportReportScreenshotBuffer(reportId);
  if (screenshot === null) {
    return NextResponse.json({ error: 'Screenshot not found.' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(screenshot.buffer), {
    status: 200,
    headers: {
      'Content-Type': screenshot.contentType,
      'Cache-Control': 'private, no-store',
    },
  });
}
