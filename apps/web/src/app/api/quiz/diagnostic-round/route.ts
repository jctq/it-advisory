import { openai } from '@ai-sdk/openai';
import { normalizeDiagnosticOptionLabels } from '@techmd/diagnostic-core/guided-diagnostic-types';
import {
  buildProjectRescueServicePromptBlock,
  resolveProjectRescueBriefAssessment,
  resolveProjectRescueGoodFitBullets,
  resolveProjectRescueSessionTitle,
} from '@techmd/diagnostic-core/project-rescue-service-context';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { DiagnosticRoundCachedPayload } from '@/domain/types';
import {
  buildDiagnosticCacheKey,
  findSemanticDiagnosticRoundCache,
  findValidDiagnosticRoundCache,
  incrementDiagnosticRoundCacheHit,
  upsertDiagnosticRoundCache,
} from '@/lib/data/diagnostic-round-cache';
import { getAppSettings } from '@/lib/data/app-settings';
import { formatDiagnosticThread } from '@/lib/marketing/diagnostic-thread';
import { SITUATION_OPTIONS } from '@/lib/marketing/situation-options';
import { respondDiagnosticSuccess } from '@/lib/server/diagnostic-round-response';

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
  initialPrompt: z.string().min(1).max(2000),
  rounds: z.array(roundSchema),
});

const situationEnum = z.enum(SITUATION_OPTIONS as unknown as [string, ...string[]]);

function buildQuestionBlockSchema(optionsPerQuestion: number) {
  return z.object({
    id: z.string().max(80),
    prompt: z.string().max(700),
    options: z.array(z.string().max(240)).length(optionsPerQuestion),
  });
}

function buildResponseSchema(maxQuestionsPerRound: number, optionsPerQuestion: number) {
  const questionBlockSchema = buildQuestionBlockSchema(optionsPerQuestion);
  return z.object({
    complete: z.boolean(),
    mappedSituation: situationEnum.nullable(),
    summaryForAdvisor: z.string().max(2500).nullable(),
    briefAssessment: z.string().max(420).nullable(),
    sessionTitle: z.string().max(120).nullable(),
    goodFitBullets: z.array(z.string().max(220)).length(3).nullable(),
    guidance: z.string().max(700).nullable(),
    questions: z.array(questionBlockSchema).max(maxQuestionsPerRound),
  });
}

function resolveDiagnosticModel(): string {
  return process.env.OPENAI_DIAGNOSTIC_MODEL ?? 'gpt-4o-mini';
}

function normalizeSituation(value: string | null | undefined): string {
  const allowed = new Set<string>(SITUATION_OPTIONS);
  if (value && allowed.has(value)) {
    return value;
  }
  return 'Not sure yet — need clarity first';
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
  const { initialPrompt, rounds } = parsed.data;
  const roundsCompleted = rounds.length;
  const settings = await getAppSettings();
  if (!settings.diagnosticAiEnabled) {
    return NextResponse.json(
      {
        error: 'AI diagnostic is currently disabled.',
        code: 'disabled',
      },
      { status: 409 },
    );
  }
  const debugOptions = { attachDebugPayload: settings.diagnosticCacheDebugEnabled };
  const maxQuestionsPerRound = settings.diagnosticQuestionsPerRound;
  const optionsPerQuestion = settings.diagnosticOptionsPerQuestion;
  const maxRoundsBeforeForceComplete = settings.diagnosticMaxRounds;
  const { normalizedThread, threadHash, cacheVersion } = buildDiagnosticCacheKey(initialPrompt, rounds);
  const exactHit = await findValidDiagnosticRoundCache(threadHash);
  if (exactHit !== null) {
    await incrementDiagnosticRoundCacheHit(exactHit.documentThreadHash);
    return respondDiagnosticSuccess(
      exactHit.payload,
      {
        source: 'cache',
        matchTier: 'exact',
        threadHash: exactHit.documentThreadHash,
        queryThreadHash: threadHash,
        cacheVersion,
        model: exactHit.model,
        semanticScore: null,
      },
      debugOptions,
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: 'Diagnostic intake requires OPENAI_API_KEY.',
        code: 'missing_key',
      },
      { status: 503 },
    );
  }
  const semanticHit = await findSemanticDiagnosticRoundCache({
    normalizedThread,
    cacheVersion,
    roundsCompleted,
  });
  if (semanticHit !== null) {
    await incrementDiagnosticRoundCacheHit(semanticHit.documentThreadHash);
    return respondDiagnosticSuccess(
      semanticHit.payload,
      {
        source: 'cache',
        matchTier: 'semantic',
        threadHash: semanticHit.documentThreadHash,
        queryThreadHash: threadHash,
        cacheVersion,
        model: semanticHit.model,
        semanticScore: semanticHit.similarityScore,
      },
      debugOptions,
    );
  }
  const thread = formatDiagnosticThread(initialPrompt, rounds);
  const mustFinish = roundsCompleted >= maxRoundsBeforeForceComplete;
  const forceInstruction = mustFinish
    ? `\n\nIMPORTANT: This was round ${roundsCompleted}. You MUST set complete=true. mappedSituation is REQUIRED. Leave questions empty. Write summaryForAdvisor (internal handoff), sessionTitle (personalized main headline), briefAssessment (customer-facing hero subtitle), AND goodFitBullets (exactly 3 short strings for a “Good fit if” bullet list—plain sentences without leading bullets/symbols; each reflects transcript-supported reasons this specialized rescue session fits them; max ~220 chars each): summaryForAdvisor captures risk, impact, environment, and advisory fit while explicitly tying findings to the Project Rescue Consultation scope in the system context (which inclusions matter most, what to validate live first). sessionTitle must briefly position the advisor's specialized rescue advisory service as it applies to this transcript (same engagement as the offering above—not generic IT help). Max ~90 characters; no quotation marks; transcript-grounded only. briefAssessment is 1–2 short sentences that tie their stated pains to this specialized session in calm, professional language — echo only transcript-supported signals; max ~320 characters; no bullets; not internal notes.`
    : `\n\nThis is round ${roundsCompleted + 1}. Unless you already have enough signal to finish now, emit **${maxQuestionsPerRound}** sharp multiple-choice questions so the user can tap through like a professional IT intake.`;
  const modelId = resolveDiagnosticModel();
  const responseSchema = buildResponseSchema(maxQuestionsPerRound, optionsPerQuestion);
  const emptyFollowupRetryLimit = 3;
  try {
    for (let attempt = 0; attempt <= emptyFollowupRetryLimit; attempt += 1) {
      const { object } = await generateObject({
        model: openai.chat(modelId),
        schema: responseSchema,
        temperature: 0.25,
        system: `You are a senior IT advisor doing intake for independent consulting (Philippines SMB context when relevant). Speak plainly. Each question must have exactly ${optionsPerQuestion} mutually exclusive tap options (short phrases). Never ask open-ended questions—always supply options. Goal: enough detail to route advisory safely without pretending to diagnose production systems.

Fixed offering for this funnel (use when complete=true to anchor summaryForAdvisor — internal handoff tone, not marketing):
${buildProjectRescueServicePromptBlock()}

Canonical situations (pick exactly ONE for mappedSituation when complete—verbatim):
${SITUATION_OPTIONS.map((s) => `- ${s}`).join('\n')}

When complete=true: questions must be an empty array; mappedSituation and summaryForAdvisor must be non-null strings; briefAssessment, sessionTitle, and goodFitBullets (exactly 3 strings) must be non-null (sessionTitle = brief headline for this specialized advisory session; briefAssessment = hero subtitle — both must align with "Advisor specialty" in the fixed offering block; distinct from summaryForAdvisor). summaryForAdvisor must synthesize the intake thread and relate it to the offering above: call out which session focus areas matter most, what remains ambiguous until validated live, and what a successful first session should clarify.

When complete=false: set mappedSituation, summaryForAdvisor, briefAssessment, sessionTitle, and goodFitBullets to null; fill questions with exactly ${maxQuestionsPerRound} items unless finishing early.`,
        prompt: `${thread}${forceInstruction}`,
      });
      if (object.complete) {
        const mappedSituation = normalizeSituation(object.mappedSituation);
        const summaryForAdvisor =
          object.summaryForAdvisor !== null && object.summaryForAdvisor.trim().length > 0
            ? object.summaryForAdvisor.trim()
            : 'Summary unavailable — follow up in session from thread above.';
        const briefAssessment = resolveProjectRescueBriefAssessment(object.briefAssessment);
        const sessionTitle = resolveProjectRescueSessionTitle(object.sessionTitle);
        const goodFitBullets = resolveProjectRescueGoodFitBullets(object.goodFitBullets);
        const payload: DiagnosticRoundCachedPayload = {
          complete: true,
          mappedSituation,
          summaryForAdvisor,
          briefAssessment,
          sessionTitle,
          goodFitBullets,
          guidance: object.guidance ?? null,
          questions: [],
        };
        await upsertDiagnosticRoundCache({
          threadHash,
          cacheVersion,
          normalizedThread,
          roundsCompleted,
          model: modelId,
          response: payload,
        });
        return respondDiagnosticSuccess(
          payload,
          {
            source: 'ai',
            matchTier: 'ai',
            threadHash,
            queryThreadHash: threadHash,
            cacheVersion,
            model: modelId,
            semanticScore: null,
          },
          debugOptions,
        );
      }
      if (mustFinish) {
        return NextResponse.json(
          {
            error: 'Model returned incomplete after maximum rounds.',
            code: 'max_rounds',
          },
          { status: 502 },
        );
      }
      const questions = object.questions
        .slice(0, maxQuestionsPerRound)
        .flatMap((question) => {
          const options = normalizeDiagnosticOptionLabels(question.options);
          if (options.length === 0) {
            return [];
          }
          return [
            {
              ...question,
              options,
            },
          ];
        });
      if (questions.length > 0) {
        const payload: DiagnosticRoundCachedPayload = {
          complete: false,
          guidance: object.guidance ?? null,
          questions,
        };
        await upsertDiagnosticRoundCache({
          threadHash,
          cacheVersion,
          normalizedThread,
          roundsCompleted,
          model: modelId,
          response: payload,
        });
        return respondDiagnosticSuccess(
          payload,
          {
            source: 'ai',
            matchTier: 'ai',
            threadHash,
            queryThreadHash: threadHash,
            cacheVersion,
            model: modelId,
            semanticScore: null,
          },
          debugOptions,
        );
      }
    }
    return NextResponse.json(
      {
        error: 'Model returned no usable questions after several attempts.',
        code: 'empty_followup_round',
      },
      { status: 502 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[api/quiz/diagnostic-round]', message, error);
    return NextResponse.json(
      {
        error: 'Diagnostic generation failed.',
        code: 'generation_error',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 502 },
    );
  }
}
