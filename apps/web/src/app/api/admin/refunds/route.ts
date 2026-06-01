import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  listBookingRefundsForAdmin,
  type BookingRefundListStatusFilter,
} from '@/lib/data/booking-refunds';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['all', 'awaiting', 'completed']).default('awaiting'),
});

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }
  const page = await listBookingRefundsForAdmin({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    status: parsed.data.status as BookingRefundListStatusFilter,
  });
  if (page === null) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }
  return NextResponse.json(page);
}
