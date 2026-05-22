import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateBookingQuote } from '@/lib/data/bookings';

const patchSchema = z
  .object({
    quotedAmountCentavos: z.number().int().min(100).max(100_000_000).nullable(),
    quoteExpiresAt: z.string().datetime().nullable(),
  })
  .refine(
    (data) =>
      data.quotedAmountCentavos === null ||
      (data.quoteExpiresAt !== null && data.quoteExpiresAt.length > 0),
    { message: 'quoteExpiresAt is required when setting a custom quote.' },
  );

type RouteContext = {
  readonly params: Promise<{ readonly bookingId: string }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { bookingId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const updated = await updateBookingQuote(bookingId, {
      quotedAmountCentavos: parsed.data.quotedAmountCentavos,
      quoteExpiresAt:
        parsed.data.quoteExpiresAt !== null ? new Date(parsed.data.quoteExpiresAt) : null,
    });
    if (updated === null) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }
    return NextResponse.json({
      quotedAmountCentavos: updated.quotedAmountCentavos,
      quoteExpiresAtIso: updated.quoteExpiresAtIso,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
