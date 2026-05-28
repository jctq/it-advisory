import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateBookingStatusByAdmin } from '@/lib/payments/payment-completion';

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
});

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
  const result = await updateBookingStatusByAdmin(bookingId, parsed.data.status);
  if (!result.ok) {
    if (result.code === 'not_found') {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Could not update booking status.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
