import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  insertBlankQuizSessionForVisitor,
  listQuizSessionsForVisitorPaginated,
  normalizeBookingListStatusFilter,
} from '@/lib/data/quiz-sessions';
import { scheduleVisitorPaymentReconciliationIfNeeded } from '@/lib/payments/reconcile-visitor-payments';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8),
  status: z
    .enum(['pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed', 'all'])
    .default('pending')
    .transform(normalizeBookingListStatusFilter),
  bookingReference: z.string().trim().optional(),
});

/**
 * Lists quiz session snapshots for the signed-in marketing account with server-side pagination and filters.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    bookingReference: url.searchParams.get('bookingReference') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', code: 'invalid_query' }, { status: 400 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const result = await listQuizSessionsForVisitorPaginated({
    visitorId,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    status: parsed.data.status,
    bookingReference: parsed.data.bookingReference,
  });
  scheduleVisitorPaymentReconciliationIfNeeded(visitorId);
  return NextResponse.json(result);
}

/**
 * Creates a new empty diagnostic session for the signed-in account and points `visitor_sessions` at it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const sessionId = await insertBlankQuizSessionForVisitor(visitorId);
  if (sessionId === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  return NextResponse.json({ sessionId: encodeQuizSessionRefForMarketingUrl(sessionId) });
}
