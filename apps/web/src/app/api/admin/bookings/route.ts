import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isManilaYmd,
  resolveManilaInclusiveYmdRangeBounds,
} from '@/lib/admin/admin-bookings-calendar-range';
import {
  findAdminCalendarBookingsByReference,
  listBookingsForAdminCalendarInRange,
  type AdminBookingCalendarStatusFilter,
} from '@/lib/data/bookings';
import { normalizeBookingReferenceInput } from '@/lib/marketing/booking-reference';

export const dynamic = 'force-dynamic';

const statusFilterSchema = z.enum(['all', 'confirmed', 'pending', 'cancelled', 'completed']);

const listQuerySchema = z
  .object({
    from: z.string().refine(isManilaYmd, { message: 'from must be YYYY-MM-DD' }),
    to: z.string().refine(isManilaYmd, { message: 'to must be YYYY-MM-DD' }),
    status: statusFilterSchema.optional(),
  })
  .refine((value) => value.from <= value.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

const referenceQuerySchema = z.object({
  reference: z.string().min(4).max(32),
});

function parseListQuery(searchParams: URLSearchParams): z.SafeParseReturnType<
  z.infer<typeof listQuerySchema>,
  z.infer<typeof listQuerySchema>
> {
  return listQuerySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  });
}

function parseReferenceQuery(searchParams: URLSearchParams): z.SafeParseReturnType<
  z.infer<typeof referenceQuerySchema>,
  z.infer<typeof referenceQuerySchema>
> {
  const reference = searchParams.get('reference');
  if (reference === null) {
    return { success: false, error: new z.ZodError([]) };
  }
  return referenceQuerySchema.safeParse({ reference });
}

/**
 * GET /api/admin/bookings — calendar range list or reference lookup.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const referenceParam = searchParams.get('reference');
  if (referenceParam !== null) {
    const parsedReference = parseReferenceQuery(searchParams);
    if (!parsedReference.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsedReference.error.flatten() },
        { status: 400 },
      );
    }
    const normalized = normalizeBookingReferenceInput(parsedReference.data.reference);
    if (normalized.length < 4) {
      return NextResponse.json(
        { error: 'Enter at least four characters of the booking reference.' },
        { status: 400 },
      );
    }
    try {
      const matches = await findAdminCalendarBookingsByReference(parsedReference.data.reference);
      if (matches.length === 0) {
        return NextResponse.json({ error: 'No booking found with that reference.' }, { status: 404 });
      }
      if (matches.length > 1) {
        return NextResponse.json(
          {
            error: `${matches.length} bookings match; enter more characters of the reference.`,
            matchCount: matches.length,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ booking: matches[0] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: 'Failed to look up booking.', details: message }, { status: 500 });
    }
  }
  const parsedList = parseListQuery(searchParams);
  if (!parsedList.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsedList.error.flatten() },
      { status: 400 },
    );
  }
  const status: AdminBookingCalendarStatusFilter = parsedList.data.status ?? 'all';
  const { startsAtFrom, startsAtToExclusive } = resolveManilaInclusiveYmdRangeBounds(
    parsedList.data.from,
    parsedList.data.to,
  );
  try {
    const result = await listBookingsForAdminCalendarInRange({
      startsAtFrom,
      startsAtToExclusive,
      status,
    });
    return NextResponse.json({
      bookings: result.bookings,
      countsByStatus: result.countsByStatus,
      range: { from: parsedList.data.from, to: parsedList.data.to },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load bookings.', details: message }, { status: 500 });
  }
}
