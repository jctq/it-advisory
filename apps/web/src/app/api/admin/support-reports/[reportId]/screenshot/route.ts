import { NextResponse } from 'next/server';
import { readSupportReportScreenshotBuffer } from '@/lib/data/support-reports';

export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly reportId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { reportId } = await context.params;
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
