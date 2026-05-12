import { NextResponse } from 'next/server';
import { activateDiagnosticTemplate } from '@/lib/data/diagnostic-templates';

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { templateId } = await context.params;
  try {
    const template = await activateDiagnosticTemplate(templateId);
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Diagnostic template not found.' || message === 'Invalid diagnostic template id.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to activate diagnostic template.', details: message }, { status });
  }
}
