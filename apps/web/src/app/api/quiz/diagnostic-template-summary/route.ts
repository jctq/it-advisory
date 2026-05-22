import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildTemplateFallbackAdvisorSummary,
  buildTemplateMappedSituationFromRounds,
} from '@/lib/marketing/diagnostic-template-flow';
import {
  buildTemplateSummaryCacheKey,
  findValidDiagnosticTemplateSummaryCache,
  incrementDiagnosticTemplateSummaryCacheHit,
  upsertDiagnosticTemplateSummaryCache,
} from '@/lib/data/diagnostic-template-summary-cache';
import { formatDiagnosticThread } from '@/lib/marketing/diagnostic-thread';
import { SITUATION_OPTIONS } from '@/lib/marketing/situation-options';
import { KNOWN_CATALOG_SERVICE_KEYS } from '@/domain/monetization-types';
import { getPublicCatalogServices } from '@/lib/data/public-catalog-services';
import { resolveRecommendedServiceKey } from '@/lib/marketing/resolve-recommended-service-key';
import {
  buildProjectRescueServicePromptBlock,
  resolveProjectRescueBriefAssessment,
  resolveProjectRescueGoodFitBullets,
  resolveProjectRescueSessionTitle,
} from '@techmd/diagnostic-core/project-rescue-service-context';

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
  briefAssessment: z.string().max(420),
  sessionTitle: z.string().max(120),
  goodFitBullets: z.array(z.string().max(220)).length(3),
  recommendedServiceKey: z.enum(KNOWN_CATALOG_SERVICE_KEYS),
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
  const { threadHash, cacheVersion, normalizedThread } = buildTemplateSummaryCacheKey({
    templateName,
    initialPrompt,
    rounds,
  });
  const catalog = await getPublicCatalogServices();
  const enabledServiceKeys = [...catalog.sessions, ...catalog.packages].map((row) => row.serviceKey);
  const cacheHit = await findValidDiagnosticTemplateSummaryCache(threadHash);
  if (cacheHit !== null) {
    await incrementDiagnosticTemplateSummaryCacheHit(cacheHit.documentThreadHash);
    const recommendedServiceKey = resolveRecommendedServiceKey({
      candidateKey: cacheHit.payload.recommendedServiceKey ?? null,
      mappedSituation,
      initialPrompt,
      advisorSummary: cacheHit.payload.summaryForAdvisor,
      enabledServiceKeys,
    });
    return NextResponse.json({
      ...cacheHit.payload,
      recommendedServiceKey,
      source: 'cache',
      model: cacheHit.model,
    });
  }
  if (!process.env.OPENAI_API_KEY) {
    const recommendedServiceKey = resolveRecommendedServiceKey({
      candidateKey: null,
      mappedSituation,
      initialPrompt,
      advisorSummary: fallbackSummary,
      enabledServiceKeys,
    });
    return NextResponse.json({
      summaryForAdvisor: fallbackSummary,
      briefAssessment: resolveProjectRescueBriefAssessment(''),
      sessionTitle: resolveProjectRescueSessionTitle(''),
      goodFitBullets: resolveProjectRescueGoodFitBullets(null),
      recommendedServiceKey,
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

Booked offering for this funnel (anchor every summaryForAdvisor — internal tone, not sales copy):
${buildProjectRescueServicePromptBlock()}

Also output sessionTitle: concise headline (max ~90 characters; no quotation marks) that briefly positions the advisor's specialized rescue advisory service for this intake—aligned with "Advisor specialty" in the fixed offering block above; transcript-grounded only; same engagement as Project Rescue Consultation—not generic IT support.

Also output briefAssessment: 1–2 short sentences under the title: connect their answers to this specialized session in plain language (calm, professional; only transcript-supported detail; max ~320 characters; no bullets; not the same as summaryForAdvisor).

Also output goodFitBullets: exactly 3 strings for a customer-facing “Good fit if” list (plain sentences; no leading • or - in each string; transcript-grounded reasons this rescue advisory session fits them; max ~220 characters each).

Also output recommendedServiceKey: pick exactly one catalog key that best matches this intake:
- project-rescue — troubled in-flight delivery, scope churn, vendor finger-pointing, stabilization
- vendor-validation — evaluating vendors, RFP, proposals, contracts before commitment
- automation-scoping — workflow/automation/integration scoping
- consultation — general clarity when situation is broad or early-stage
- package-3-sessions — when multiple checkpoints across a program are implied (less common)

Write a concise summaryForAdvisor that:
- synthesizes the most important selections, symptoms, constraints, and risks
- mentions timeline/impact clues only if they appear in the answers
- highlights what the advisor should validate first in the session
- explicitly ties the thread to the offering above: which session inclusions matter most, what gaps the listed scope helps close, and what a strong first session should establish
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
    const briefAssessment = resolveProjectRescueBriefAssessment(object.briefAssessment);
    const sessionTitle = resolveProjectRescueSessionTitle(object.sessionTitle);
    const goodFitBullets = resolveProjectRescueGoodFitBullets(object.goodFitBullets);
    const recommendedServiceKey = resolveRecommendedServiceKey({
      candidateKey: object.recommendedServiceKey,
      mappedSituation,
      initialPrompt,
      advisorSummary: summaryForAdvisor,
      enabledServiceKeys,
    });
    const responseBody = {
      summaryForAdvisor,
      briefAssessment,
      sessionTitle,
      mappedSituation,
      goodFitBullets,
      recommendedServiceKey,
    };
    await upsertDiagnosticTemplateSummaryCache({
      threadHash,
      cacheVersion,
      templateName,
      normalizedThread,
      model: modelId,
      response: responseBody,
    });
    return NextResponse.json({
      ...responseBody,
      source: 'ai',
      model: modelId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[api/quiz/diagnostic-template-summary]', message, error);
    const recommendedServiceKey = resolveRecommendedServiceKey({
      candidateKey: null,
      mappedSituation,
      initialPrompt,
      advisorSummary: fallbackSummary,
      enabledServiceKeys,
    });
    return NextResponse.json({
      summaryForAdvisor: fallbackSummary,
      briefAssessment: resolveProjectRescueBriefAssessment(''),
      sessionTitle: resolveProjectRescueSessionTitle(''),
      goodFitBullets: resolveProjectRescueGoodFitBullets(null),
      recommendedServiceKey,
      mappedSituation,
      source: 'fallback',
      model: null,
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}
