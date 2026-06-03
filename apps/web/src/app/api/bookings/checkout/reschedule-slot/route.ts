import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { jsonApiValidationError, jsonApiErrorFromUnknown } from '@/lib/server/api-error-response';
import { z } from 'zod';
import { ensureDiagnosticSessionPendingBookingReadyForCheckout } from '@/lib/booking/ensure-diagnostic-session-pending-booking-ready-for-checkout';
import { findDiagnosticSessionForVisitor } from '@/lib/data/diagnostic-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { resolveDiagnosticSessionObjectIdHexFromMarketingRef } from '@/lib/server/diagnostic-session-marketing-ref-crypto';

const postBodySchema = z.object({
  sessionRef: z.string().min(1).max(512),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(32),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = postBodySchema.safeParse(json);
    if (!parsed.success) {
      return jsonApiValidationError(parsed.error);
    }
    const sessionHex = resolveDiagnosticSessionObjectIdHexFromMarketingRef(parsed.data.sessionRef);
    if (sessionHex === null) {
      return NextResponse.json({ error: 'Invalid session reference', code: 'diagnostic_session_invalid_id' }, { status: 400 });
    }
    const visitorId = await resolveMarketingVisitorId(request);
    const ownedSession = await findDiagnosticSessionForVisitor(visitorId, sessionHex);
    if (ownedSession === null) {
      return NextResponse.json(
        { error: 'This diagnostic was not found or you no longer have access to it.', code: 'diagnostic_session_not_found' },
        { status: 404 },
      );
    }
    const result = await ensureDiagnosticSessionPendingBookingReadyForCheckout(
      visitorId,
      new ObjectId(sessionHex),
      {
        dateYmd: parsed.data.date,
        timeLabel: parsed.data.time,
      },
      { requirePayable: false },
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
    }
    return NextResponse.json({ ok: true as const });
  } catch (error: unknown) {
    console.error('[checkout/reschedule-slot] failed', error);
    return jsonApiErrorFromUnknown(error, {
      error: 'Could not save your new session time.',
      status: 500,
      code: 'internal_error',
    });
  }
}
