import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createBookingWithLatestQuizSnapshot,
  findBookingByVisitorSlot,
  linkQuizSessionToVisitorBooking,
  syncBookingQuizSessionIfPointerChanged,
} from '@/lib/data/bookings';
import { insertMarketingBookingLead } from '@/lib/data/leads';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';

const postBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(48),
  serviceKey: z.string().min(1).max(120).default('project-rescue'),
  quizSessionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

/**
 * Persists a marketing booking and copies the latest quiz diagnostic (full rounds, questions, options) for admin CRM.
 */
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
  const visitorId = await resolveMarketingVisitorId(request);
  let startsAt: Date;
  try {
    startsAt = parseBookingSlotToUtc(parsed.data.date, parsed.data.time);
  } catch {
    return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 });
  }
  const serviceKey = parsed.data.serviceKey;
  const existingId = await findBookingByVisitorSlot({ visitorId, serviceKey, startsAt });
  if (existingId !== null) {
    if (parsed.data.quizSessionId !== undefined) {
      const linked = await linkQuizSessionToVisitorBooking({
        bookingId: existingId,
        visitorId,
        quizSessionIdHex: parsed.data.quizSessionId,
      });
      if (!linked) {
        return NextResponse.json(
          { error: 'Could not link this diagnostic to the existing reservation.', code: 'quiz_link_failed' },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true as const,
        bookingId: existingId.toString(),
        deduped: true as const,
        quizSessionLinked: true as const,
      });
    }
    await syncBookingQuizSessionIfPointerChanged({ bookingId: existingId, visitorId });
    return NextResponse.json({
      ok: true as const,
      bookingId: existingId.toString(),
      deduped: true as const,
    });
  }
  const leadId = await insertMarketingBookingLead(visitorId);
  if (leadId === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  const created = await createBookingWithLatestQuizSnapshot({
    visitorId,
    serviceKey,
    startsAt,
    timezone: PRIMARY_TIMEZONE,
    leadId,
    preferredQuizSessionId: parsed.data.quizSessionId,
  });
  if (created === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  return NextResponse.json({
    ok: true as const,
    bookingId: created.bookingId.toString(),
    deduped: false as const,
  });
}
