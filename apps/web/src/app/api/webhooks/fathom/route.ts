import { NextResponse } from 'next/server';
import { processFathomWebhook } from '@/lib/fathom/process-fathom-webhook';

export async function POST(request: Request): Promise<NextResponse> {
  const bodyText = await request.text();
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  try {
    const result = await processFathomWebhook({ bodyText, headers });
    return NextResponse.json({ ok: result.handled }, { status: result.status });
  } catch (error: unknown) {
    console.error('[fathom-webhook] unhandled error', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
