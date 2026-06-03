import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdminEmailAllowed } from '@/lib/server/admin-allowed-emails';
import { isValidAdminServiceBearer } from '@/lib/server/admin-service-token';
import { isProductionNodeEnv } from '@/lib/server/is-production-node-env';

export type AdminAccessResult =
  | { readonly authorized: true; readonly email: string | null; readonly viaServiceToken: boolean }
  | { readonly authorized: false; readonly response: NextResponse };

function allowDevAdminOpen(): boolean {
  return !isProductionNodeEnv() && process.env.ALLOW_DEV_ADMIN_OPEN?.trim() === '1';
}

/**
 * Ensures the request has a valid admin OAuth session or service Bearer token.
 */
export async function requireAdminSession(request: Request): Promise<AdminAccessResult> {
  if (isValidAdminServiceBearer(request.headers.get('authorization'))) {
    return { authorized: true, email: null, viaServiceToken: true };
  }
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (email !== null && isAdminEmailAllowed(email)) {
    return { authorized: true, email, viaServiceToken: false };
  }
  if (allowDevAdminOpen()) {
    return { authorized: true, email: null, viaServiceToken: false };
  }
  return {
    authorized: false,
    response: NextResponse.json(
      { error: 'Unauthorized', code: 'admin_session_required' },
      { status: 401 },
    ),
  };
}

/**
 * Returns a 401 response when the request lacks admin authorization; otherwise null.
 */
export async function rejectUnlessAdminSession(request: Request): Promise<NextResponse | null> {
  const access = await requireAdminSession(request);
  if (!access.authorized) {
    return access.response;
  }
  return null;
}
