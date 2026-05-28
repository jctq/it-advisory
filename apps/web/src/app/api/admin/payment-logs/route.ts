import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PAYMENT_GATEWAY_IDS } from '@/domain/payment-types';
import { PAYMENT_LOG_OUTCOMES } from '@/domain/payment-log-types';
import { listPaymentLogsForAdminPage } from '@/lib/data/payment-logs';

export const dynamic = 'force-dynamic';

const outcomeFilterSchema = z.enum(['all', ...PAYMENT_LOG_OUTCOMES]);

const gatewayFilterSchema = z.enum(['all', ...PAYMENT_GATEWAY_IDS]);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().max(200).optional(),
  outcome: outcomeFilterSchema.optional(),
  gatewayId: gatewayFilterSchema.optional(),
});

/**
 * GET /api/admin/payment-logs — paginated payment webhook log list for admin debug.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    outcome: url.searchParams.get('outcome') ?? undefined,
    gatewayId: url.searchParams.get('gatewayId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await listPaymentLogsForAdminPage({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.q,
      outcome: parsed.data.outcome,
      gatewayId: parsed.data.gatewayId,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load payment logs.', details: message }, { status: 500 });
  }
}
