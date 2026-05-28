import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listSupportReportsForReporter } from '@/lib/data/support-reports';
import { assertSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const dynamic = 'force-dynamic';

const listStatusSchema = z.enum(['all', 'awaiting_reply', 'has_reply']);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().max(200).optional(),
  status: listStatusSchema.optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const disabledResponse = await assertSupportModuleEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', code: 'invalid_query' }, { status: 400 });
  }
  try {
    const result = await listSupportReportsForReporter({
      userId: user.id,
      email: user.email,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.q,
      status: parsed.data.status,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load reports.', details: message }, { status: 500 });
  }
}
