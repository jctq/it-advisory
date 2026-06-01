import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeBookingRefundByAdmin } from '@/lib/data/booking-refunds';

export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly refundId: string }>;
};

const completeSchema = z.object({
  refundAmountCentavos: z.number().int().min(0).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

function resolveHttpStatus(code: string): number {
  if (code === 'not_found') {
    return 404;
  }
  if (code === 'database_unavailable') {
    return 503;
  }
  if (code === 'server_error') {
    return 500;
  }
  return 400;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { refundId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = completeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await completeBookingRefundByAdmin({
    refundId,
    refundAmountCentavos: parsed.data.refundAmountCentavos,
    adminNotes: parsed.data.adminNotes,
  });
  if (!result.ok) {
    const message =
      result.code === 'invalid_state'
        ? 'This refund is not awaiting completion.'
        : result.code === 'not_found'
          ? 'Refund not found.'
          : 'Failed to complete refund.';
    return NextResponse.json({ error: message, code: result.code }, { status: resolveHttpStatus(result.code) });
  }
  return NextResponse.json({ ok: true });
}
