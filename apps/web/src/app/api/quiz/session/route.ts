import { NextResponse } from 'next/server';
import { z } from 'zod';
import { countBookingsByQuizSessionId } from '@/lib/data/bookings';
import { buildDiagnosticThreadJson, GUIDED_DIAGNOSTIC_EMPTY, serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import {
  deleteQuizSessionForVisitor,
  findLatestQuizSession,
  findQuizSessionForVisitor,
  upsertQuizProgress,
} from '@/lib/data/quiz-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';

const patchBodySchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  currentStep: z.number().int().min(0),
  completed: z.boolean().optional(),
  sessionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

const RESET_QUIZ_ANSWERS = {
  guidedDiagnostic: serializeGuidedDiagnostic(GUIDED_DIAGNOSTIC_EMPTY),
  situation: '',
  situationAdvisorSummary: '',
  situationDiagnosticThread: buildDiagnosticThreadJson(GUIDED_DIAGNOSTIC_EMPTY),
} as const;

type OptionalSessionIdQuery =
  | { readonly status: 'absent' }
  | { readonly status: 'invalid' }
  | { readonly status: 'ok'; readonly sessionId: string };

function parseSessionIdQuery(request: Request): OptionalSessionIdQuery {
  const raw = new URL(request.url).searchParams.get('sessionId')?.trim() ?? '';
  if (raw.length === 0) {
    return { status: 'absent' };
  }
  if (!/^[a-f\d]{24}$/i.test(raw)) {
    return { status: 'invalid' };
  }
  return { status: 'ok', sessionId: raw };
}

export async function GET(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  const session =
    parsedId.status === 'ok'
      ? await findQuizSessionForVisitor(visitorId, parsedId.sessionId)
      : await findLatestQuizSession(visitorId);
  if (parsedId.status === 'ok' && session === null) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  if (!session) {
    return NextResponse.json({
      session: null,
    });
  }
  if (session._id === undefined) {
    return NextResponse.json({
      session: {
        answers: session.answers,
        currentStep: session.currentStep,
      },
      readOnly: false,
    });
  }
  const bookedCount = await countBookingsByQuizSessionId(session._id);
  return NextResponse.json({
    session: {
      answers: session.answers,
      currentStep: session.currentStep,
    },
    readOnly: bookedCount > 0,
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
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
  const { answers, currentStep, completed, sessionId } = parsed.data;
  let targetForBooking: Awaited<ReturnType<typeof findLatestQuizSession>> = null;
  if (sessionId !== undefined) {
    targetForBooking = await findQuizSessionForVisitor(visitorId, sessionId);
  } else {
    targetForBooking = await findLatestQuizSession(visitorId);
  }
  if (targetForBooking !== null && targetForBooking._id !== undefined) {
    const bookedCount = await countBookingsByQuizSessionId(targetForBooking._id);
    if (bookedCount > 0) {
      return NextResponse.json(
        {
          error: 'This diagnostic is linked to a booking and cannot be edited.',
          code: 'quiz_session_read_only',
        },
        { status: 403 },
      );
    }
  }
  const result = await upsertQuizProgress({
    visitorId,
    answers,
    currentStep,
    isComplete: completed ?? false,
    targetSessionId: sessionId,
  });
  if (!result.persisted && sessionId !== undefined) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    sessionId: result.sessionId ?? null,
    persisted: result.persisted,
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  if (parsedId.status === 'ok') {
    const outcome = await deleteQuizSessionForVisitor(visitorId, parsedId.sessionId);
    if (outcome.ok === false) {
      if (outcome.code === 'has_booking') {
        return NextResponse.json(
          {
            error: 'This diagnostic is linked to a booking and cannot be deleted.',
            code: 'quiz_session_has_booking',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
    }
    return NextResponse.json({ deleted: true as const, sessionId: parsedId.sessionId });
  }
  const latestSession = await findLatestQuizSession(visitorId);

  if (!latestSession) {
    return NextResponse.json({
      persisted: false,
      reset: false,
      sessionId: null,
    });
  }
  if (latestSession._id !== undefined) {
    const bookedCount = await countBookingsByQuizSessionId(latestSession._id);
    if (bookedCount > 0) {
      /**
       * Latest snapshot is already linked to a booking — do not reset it and do not insert a replacement row.
       * (Previously we created a blank session here so the visitor had a fresh row; product prefers no new diagnostic
       * until the user explicitly starts one from My diagnostics or /quiz.)
       */
      return NextResponse.json({
        persisted: false,
        reset: false,
        sessionId: latestSession._id.toString(),
      });
    }
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
