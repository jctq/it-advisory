import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAdminClientDiagnostic } from '@/lib/data/admin-client-diagnostic';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    diagnostic: z.string().min(1).max(512).optional(),
    sessionId: z.string().min(1).max(512).optional(),
    reference: z.string().min(1).max(32).optional(),
    bookingReference: z.string().min(1).max(32).optional(),
  })
  .refine(
    (value) =>
      (value.diagnostic?.trim().length ?? 0) > 0 ||
      (value.sessionId?.trim().length ?? 0) > 0 ||
      (value.reference?.trim().length ?? 0) > 0 ||
      (value.bookingReference?.trim().length ?? 0) > 0,
    { message: 'Provide diagnostic (session ref) and/or reference (booking ref).' },
  );

/**
 * GET /api/admin/client-diagnostic — full client diagnostic + booking payability report.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    diagnostic: searchParams.get('diagnostic') ?? undefined,
    sessionId: searchParams.get('sessionId') ?? undefined,
    reference: searchParams.get('reference') ?? undefined,
    bookingReference: searchParams.get('bookingReference') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provide a diagnostic session ref/id and/or a booking reference.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const diagnostic =
    parsed.data.diagnostic?.trim() ?? parsed.data.sessionId?.trim() ?? '';
  const reference =
    parsed.data.reference?.trim() ?? parsed.data.bookingReference?.trim() ?? '';
  try {
    const report = await runAdminClientDiagnostic({ diagnostic, reference });
    if (report === null) {
      return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
    }
    if (report.sessions.length === 0 && report.bookings.length === 0) {
      return NextResponse.json(
        { error: 'No diagnostic session or booking matched the inputs.', report },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to run client diagnostic.', details: message }, { status: 500 });
  }
}
