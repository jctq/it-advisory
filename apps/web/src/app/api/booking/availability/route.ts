import { differenceInCalendarDays, parseISO } from 'date-fns';
import { NextResponse } from 'next/server';
import { jsonApiValidationError, jsonApiErrorFromUnknown } from '@/lib/server/api-error-response';
import { z } from 'zod';
import {
  getCheckoutBookingAvailabilitySlots,
  getPublicBookingAvailabilitySlots,
} from '@/lib/data/booking-availability';
import { findDiagnosticSessionForVisitor } from '@/lib/data/diagnostic-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { resolveDiagnosticSessionObjectIdHexFromMarketingRef } from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceKey: z.string().min(1).max(120).default('project-rescue'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionRef: z.string().min(1).max(512).optional(),
});

const MAX_RANGE_DAYS = 93 as const;

function compareYmd(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Public allowlist of bookable marketing slots (no busy metadata).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'booking_availability');
  if (rateLimited !== null) {
    return rateLimited;
  }
  const url = new URL(request.url);
  const raw = {
    serviceKey: url.searchParams.get('serviceKey') ?? undefined,
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? '',
    sessionRef: url.searchParams.get('sessionRef') ?? undefined,
  };
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error);
  }
  if (compareYmd(parsed.data.from, parsed.data.to) > 0) {
    return NextResponse.json({ error: '`from` must be on or before `to`.' }, { status: 400 });
  }
  const rangeDays = differenceInCalendarDays(parseISO(parsed.data.to), parseISO(parsed.data.from));
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: 'Requested date range is too large.' }, { status: 400 });
  }
  try {
    const sessionRef = parsed.data.sessionRef?.trim() ?? '';
    if (sessionRef.length > 0) {
      const sessionHex = resolveDiagnosticSessionObjectIdHexFromMarketingRef(sessionRef);
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
      const slots = await getCheckoutBookingAvailabilitySlots({
        serviceKey: parsed.data.serviceKey,
        fromYmd: parsed.data.from,
        toYmd: parsed.data.to,
        diagnosticSessionIdHex: sessionHex,
        visitorId,
      });
      return NextResponse.json(
        { slots },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        },
      );
    }
    const slots = await getPublicBookingAvailabilitySlots({
      serviceKey: parsed.data.serviceKey,
      fromYmd: parsed.data.from,
      toYmd: parsed.data.to,
    });
    return NextResponse.json(
      { slots },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error: unknown) {
    return jsonApiErrorFromUnknown(error, { error: 'Failed to load availability.', status: 500 });
  }
}
