import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteDiagnosticTemplate, updateDiagnosticTemplate } from '@/lib/data/diagnostic-templates';
import type { DiagnosticTemplateInput } from '@/lib/diagnostic-template-types';

const optionSchema = z.object({
  id: z.string().max(120),
  label: z.string().max(240),
  description: z.string().max(320).nullable().default(null),
});

const questionSchema = z.object({
  id: z.string().max(120),
  prompt: z.string().max(700),
  description: z.string().max(320).nullable().default(null),
  options: z.array(optionSchema),
});

const roundSchema = z.object({
  id: z.string().max(120),
  title: z.string().max(160),
  guidance: z.string().max(700).nullable(),
  questions: z.array(questionSchema),
});

const updateTemplateSchema = z.object({
  name: z.string().max(120),
  rounds: z.array(roundSchema),
});

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = updateTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const input: DiagnosticTemplateInput = {
    name: parsed.data.name,
    rounds: parsed.data.rounds.map((round) => ({
      id: round.id,
      title: round.title,
      guidance: round.guidance,
      questions: round.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        description: question.description ?? null,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description ?? null,
        })),
      })),
    })),
  };
  const { templateId } = await context.params;
  try {
    const template = await updateDiagnosticTemplate(templateId, input);
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Diagnostic template not found.' || message === 'Invalid diagnostic template id.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to update diagnostic template.', details: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { templateId } = await context.params;
  try {
    await deleteDiagnosticTemplate(templateId);
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message === 'Diagnostic template not found.' || message === 'Invalid diagnostic template id.'
        ? 404
        : message === 'Activate a different template before deleting this one.'
          ? 409
          : 500;
    return NextResponse.json({ error: 'Failed to delete diagnostic template.', details: message }, { status });
  }
}
