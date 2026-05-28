import { NextResponse } from 'next/server';
import { countUnreadSupportReportsForReporter } from '@/lib/data/support-reports';
import { assertSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const disabledResponse = await assertSupportModuleEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  try {
    const unreadCount = await countUnreadSupportReportsForReporter({
      userId: user.id,
      email: user.email,
    });
    return NextResponse.json({ unreadCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load unread count.', details: message }, { status: 500 });
  }
}
