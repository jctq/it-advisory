import { NextResponse } from 'next/server';
import { z } from 'zod';
import { countBookingsByQuizSessionId, findPrimaryBookingSlotByQuizSessionId } from '@/lib/data/bookings';
import { buildDiagnosticThreadJson, GUIDED_DIAGNOSTIC_EMPTY, serializeGuidedDiagnostic } from '@/lib/marketing/guided-diagnostic-types';
import {
  deleteQuizSessionForVisitor,
  findLatestQuizSession,
  findQuizSessionForVisitor,
  insertBlankQuizSessionForVisitor,
  upsertQuizProgress,
} from '@/lib/data/quiz-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import {
  encodeQuizSessionRefForMarketingUrl,
  resolveQuizSessionObjectIdHexFromMarketingRef,
} from '@/lib/server/quiz-session-marketing-ref-crypto';

const patchBodySchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  currentStep: z.number().int().min(0),
  completed: z.boolean().optional(),
  sessionId: z.string().min(1).max(512).optional(),
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
  | { readonly status: 'ok'; readonly objectIdHex: string };

function parseSessionIdQuery(request: Request): OptionalSessionIdQuery {
  const raw = new URL(request.url).searchParams.get('sessionId')?.trim() ?? '';
  if (raw.length === 0) {
    return { status: 'absent' };
  }
  const objectIdHex = resolveQuizSessionObjectIdHexFromMarketingRef(raw);
  if (objectIdHex === null) {
    return { status: 'invalid' };
  }
  return { status: 'ok', objectIdHex };
}

export async function GET(request: Request): Promise<NextResponse> {
  const visitorId = await resolveMarketingVisitorId(request);
  const parsedId = parseSessionIdQuery(request);
  if (parsedId.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  const session =
    parsedId.status === 'ok'
      ? await findQuizSessionForVisitor(visitorId, parsedId.objectIdHex)
      : await findLatestQuizSession(visitorId);
  if (parsedId.status === 'ok' && session === null) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  if (!session) {
    return NextResponse.json({
      session: null,
      sessionId: null,
    });
  }
  if (session._id === undefined) {
    return NextResponse.json({
      session: {
        answers: session.answers,
        currentStep: session.currentStep,
      },
      readOnly: false,
      sessionId: null,
    });
  }
  const bookedCount = await countBookingsByQuizSessionId(session._id);
  const linkedBookingSlot =
    bookedCount > 0 ? await findPrimaryBookingSlotByQuizSessionId(session._id) : null;
  return NextResponse.json({
    session: {
      answers: session.answers,
      currentStep: session.currentStep,
    },
    readOnly: bookedCount > 0,
    sessionId: encodeQuizSessionRefForMarketingUrl(session._id.toString()),
    linkedBookingSlot:
      linkedBookingSlot === null
        ? null
        : {
            status: linkedBookingSlot.status,
            startsAtIso: linkedBookingSlot.startsAtIso,
            timezone: linkedBookingSlot.timezone,
            serviceKey: linkedBookingSlot.serviceKey,
            meetingUrl: linkedBookingSlot.meetingUrl,
          },
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
  const { answers, currentStep, completed, sessionId: sessionIdRaw } = parsed.data;
  let resolvedTargetSessionHex: string | undefined;
  if (sessionIdRaw !== undefined) {
    const resolved = resolveQuizSessionObjectIdHexFromMarketingRef(sessionIdRaw);
    if (resolved === null) {
      return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
    }
    resolvedTargetSessionHex = resolved;
  }
  let targetForBooking: Awaited<ReturnType<typeof findLatestQuizSession>> = null;
  if (resolvedTargetSessionHex !== undefined) {
    targetForBooking = await findQuizSessionForVisitor(visitorId, resolvedTargetSessionHex);
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
    targetSessionId: resolvedTargetSessionHex,
  });
  if (!result.persisted && resolvedTargetSessionHex !== undefined) {
    return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    sessionId:
      result.sessionId !== undefined ? encodeQuizSessionRefForMarketingUrl(result.sessionId) : null,
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
    const outcome = await deleteQuizSessionForVisitor(visitorId, parsedId.objectIdHex);
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
    return NextResponse.json({
      deleted: true as const,
      sessionId: encodeQuizSessionRefForMarketingUrl(parsedId.objectIdHex),
    });
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
       * Latest row is the diagnostic captured at checkout — it must stay in Mongo for CRM. Point the visitor at a
       * new blank session so guests (and signed-in users) can start another diagnostic from home or `/quiz` after
       * booking without reusing the read-only snapshot.
       */
      const newSessionHex = await insertBlankQuizSessionForVisitor(visitorId);
      if (newSessionHex === null) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
      }
      return NextResponse.json({
        persisted: true,
        reset: true,
        sessionId: encodeQuizSessionRefForMarketingUrl(newSessionHex),
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
    sessionId: result.sessionId !== undefined ? encodeQuizSessionRefForMarketingUrl(result.sessionId) : null,
  });
}
