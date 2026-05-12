import { NextResponse } from 'next/server';
import { getPublicActiveDiagnosticTemplate } from '@/lib/data/diagnostic-templates';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const template = await getPublicActiveDiagnosticTemplate();
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load active diagnostic template.', details: message }, { status: 500 });
  }
}
