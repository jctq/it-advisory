import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDiagnosticTemplate, listDiagnosticTemplates } from '@/lib/data/diagnostic-templates';

const createTemplateSchema = z.object({
  name: z.string().trim().max(120).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const templates = await listDiagnosticTemplates();
    return NextResponse.json({ templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load diagnostic templates.', details: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {}
  const parsed = createTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const template = await createDiagnosticTemplate(parsed.data.name);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create diagnostic template.', details: message }, { status: 500 });
  }
}
