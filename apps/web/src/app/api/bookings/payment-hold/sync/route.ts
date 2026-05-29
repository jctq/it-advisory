import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncQuizSessionPaymentHold } from '@/lib/payments/sync-quiz-session-payment-hold';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { resolveQuizSessionObjectIdHexFromMarketingRef } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';

const postBodySchema = z.object({
  sessionRef: z.string().min(1).max(512),
});

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const sessionHex = resolveQuizSessionObjectIdHexFromMarketingRef(parsed.data.sessionRef);
  if (sessionHex === null) {
    return NextResponse.json({ error: 'Invalid session reference', code: 'quiz_session_invalid_id' }, { status: 400 });
  }
  const visitorId = await resolveMarketingVisitorId(request);
  const ownedSession = await findQuizSessionForVisitor(visitorId, sessionHex);
  if (ownedSession === null) {
    return NextResponse.json(
      { error: 'This diagnostic was not found or you no longer have access to it.', code: 'quiz_session_not_found' },
      { status: 404 },
    );
  }
  const now = new Date();
  const result = await syncQuizSessionPaymentHold({
    quizSessionIdHex: sessionHex,
    visitorId,
    now,
  });
  return NextResponse.json({
    nowIso: now.toISOString(),
    expired: result.expired,
    cancelled: result.expired,
    bookingId: result.bookingId,
  });
}
