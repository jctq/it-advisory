import { NextResponse } from 'next/server';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';
import { resolveRedirectOrigin } from '@/lib/server/resolve-redirect-origin';

/**
 * Legacy token login removed — redirect to OAuth sign-in.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'admin_login');
  if (rateLimited !== null) {
    return rateLimited;
  }
  void recordSecurityEvent({
    type: 'admin_login_failure',
    request,
    path: '/api/admin/login',
    outcome: 'failure',
    metadata: { reason: 'legacy_token_login_removed' },
  }).catch(() => undefined);
  const loginUrl = new URL('/admin/login', resolveRedirectOrigin(request));
  loginUrl.searchParams.set('error', 'Configuration');
  return NextResponse.redirect(loginUrl, { status: 303 });
}
