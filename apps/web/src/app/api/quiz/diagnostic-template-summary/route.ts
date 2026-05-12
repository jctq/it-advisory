import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildTemplateFallbackAdvisorSummary,
  buildTemplateMappedSituationFromRounds,
} from '@/lib/marketing/diagnostic-template-flow';
import { formatDiagnosticThread } from '@/lib/marketing/diagnostic-thread';
import { SITUATION_OPTIONS } from '@/lib/marketing/situation-options';

const qaSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  answer: z.string(),
});

const roundSchema = z.object({
  roundIndex: z.number().int().min(0),
  qa: z.array(qaSchema),
});

const requestSchema = z.object({
  templateName: z.string().min(1).max(160),
  initialPrompt: z.string().max(2000).optional().default(''),
  rounds: z.array(roundSchema).min(1),
});

const responseSchema = z.object({
  summaryForAdvisor: z.string().max(2500),
});

function resolveDiagnosticModel(): string {
  return process.env.OPENAI_DIAGNOSTIC_MODEL ?? 'gpt-4o-mini';
}

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { templateName, initialPrompt, rounds } = parsed.data;
  const fallbackSummary = buildTemplateFallbackAdvisorSummary(templateName, initialPrompt, rounds);
  const mappedSituation = buildTemplateMappedSituationFromRounds(initialPrompt, rounds);
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      summaryForAdvisor: fallbackSummary,
      mappedSituation,
      source: 'fallback',
      model: null,
    });
  }
  const modelId = resolveDiagnosticModel();
  const thread = formatDiagnosticThread(initialPrompt, rounds);
  try {
    const { object } = await generateObject({
      model: openai.chat(modelId),
      schema: responseSchema,
      temperature: 0.2,
      system: `You are a senior IT advisor writing an internal handoff summary for another advisor.

Summarize only what the customer actually selected or typed in a fixed diagnostic template. Do not invent architecture, incidents, vendors, or business context that the transcript does not support.

Write a concise summaryForAdvisor that:
- synthesizes the most important selections, symptoms, constraints, and risks
- mentions timeline/impact clues only if they appear in the answers
- highlights what the advisor should validate first in the session
- sounds like an internal professional note, not customer-facing marketing copy

Canonical situation labels for reference:
${SITUATION_OPTIONS.map((option) => `- ${option}`).join('\n')}

Do not output bullet syntax unless it materially improves clarity. Plain prose is preferred.`,
      prompt: `Template name: ${templateName}
Mapped situation heuristic: ${mappedSituation}

${thread}`,
    });
    const summaryForAdvisor =
      object.summaryForAdvisor.trim().length > 0 ? object.summaryForAdvisor.trim() : fallbackSummary;
    return NextResponse.json({
      summaryForAdvisor,
      mappedSituation,
      source: 'ai',
      model: modelId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[api/quiz/diagnostic-template-summary]', message, error);
    return NextResponse.json({
      summaryForAdvisor: fallbackSummary,
      mappedSituation,
      source: 'fallback',
      model: null,
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}
