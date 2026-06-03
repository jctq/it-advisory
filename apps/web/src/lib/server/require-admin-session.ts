import { NextResponse } from 'next/server';
import {
  isAdminFullyAuthorized,
  resolveAdminOtpSessionState,
} from '@/lib/server/admin-otp-session';
import { isValidAdminServiceBearer } from '@/lib/server/admin-service-token';

export type AdminAccessResult =
  | { readonly authorized: true; readonly email: string | null; readonly viaServiceToken: boolean }
  | { readonly authorized: false; readonly response: NextResponse };

/**
 * Ensures the request has a valid admin OAuth session or service Bearer token.
 */
export async function requireAdminSession(request: Request): Promise<AdminAccessResult> {
  const state = await resolveAdminOtpSessionState(request);
  if (isAdminFullyAuthorized(state)) {
    return { authorized: true, email: state.email, viaServiceToken: state.viaServiceToken };
  }
  if (state.hasAllowlistedSession && state.otpRequired && !state.otpVerified && !state.viaServiceToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Email verification required', code: 'admin_otp_required' },
        { status: 401 },
      ),
    };
  }
  if (isValidAdminServiceBearer(request.headers.get('authorization'))) {
    return { authorized: true, email: null, viaServiceToken: true };
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
