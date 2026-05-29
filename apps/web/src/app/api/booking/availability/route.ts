import { differenceInCalendarDays, parseISO } from 'date-fns';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicBookingAvailabilitySlots } from '@/lib/data/booking-availability';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceKey: z.string().min(1).max(120).default('project-rescue'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  const url = new URL(request.url);
  const raw = {
    serviceKey: url.searchParams.get('serviceKey') ?? undefined,
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? '',
  };
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  if (compareYmd(parsed.data.from, parsed.data.to) > 0) {
    return NextResponse.json({ error: '`from` must be on or before `to`.' }, { status: 400 });
  }
  const rangeDays = differenceInCalendarDays(parseISO(parsed.data.to), parseISO(parsed.data.from));
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: 'Requested date range is too large.' }, { status: 400 });
  }
  try {
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load availability.', details: message }, { status: 500 });
  }
}
