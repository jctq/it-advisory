import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildDiagnosticThreadJson, GUIDED_DIAGNOSTIC_EMPTY, serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import { findLatestQuizSession, upsertQuizProgress } from '@/lib/data/quiz-sessions';
import { readOrCreateVisitorId } from '@/lib/server/visitor-cookie';

const patchBodySchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  currentStep: z.number().int().min(0),
  completed: z.boolean().optional(),
});

const RESET_QUIZ_ANSWERS = {
  guidedDiagnostic: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
  situation: '',
  situationAdvisorSummary: '',
  situationDiagnosticThread: buildDiagnosticThreadJson(GUIDED_DIAGNOSTIC_EMPTY),
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const visitorId = await readOrCreateVisitorId(request);
  const session = await findLatestQuizSession(visitorId);
  if (!session) {
    return NextResponse.json({
      session: null,
    });
  }
  return NextResponse.json({
    session: {
      answers: session.answers,
      currentStep: session.currentStep,
    },
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const visitorId = await readOrCreateVisitorId(request);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { answers, currentStep, completed } = parsed.data;
  const result = await upsertQuizProgress({
    visitorId,
    answers,
    currentStep,
    isComplete: completed ?? false,
  });
  return NextResponse.json({
    sessionId: result.sessionId ?? null,
    persisted: result.persisted,
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const visitorId = await readOrCreateVisitorId(request);
  const latestSession = await findLatestQuizSession(visitorId);

  if (!latestSession) {
    return NextResponse.json({
      persisted: false,
      reset: false,
      sessionId: null,
    });
  }

  const result = await upsertQuizProgress({
    visitorId,
    answers: RESET_QUIZ_ANSWERS,
    currentStep: 0,
    isComplete: false,
  });

  return NextResponse.json({
    persisted: result.persisted,
    reset: true,
    sessionId: result.sessionId ?? null,
  });
}
