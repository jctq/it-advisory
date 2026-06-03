import 'server-only';
import { auth } from '@/auth';
import { isAdminEmailAllowed } from '@/lib/server/admin-allowed-emails';
import { isAdminEmailOtpRequired } from '@/lib/server/admin-email-otp-config';
import { isValidAdminServiceBearer } from '@/lib/server/admin-service-token';
import { isProductionNodeEnv } from '@/lib/server/is-production-node-env';
import { NextResponse } from 'next/server';

export type AdminOtpSessionState = {
  readonly hasAllowlistedSession: boolean;
  readonly email: string | null;
  readonly otpRequired: boolean;
  readonly otpVerified: boolean;
  readonly viaServiceToken: boolean;
};

function allowDevAdminOpen(): boolean {
  return !isProductionNodeEnv() && process.env.ALLOW_DEV_ADMIN_OPEN?.trim() === '1';
}

/**
 * Resolves whether the current request has a pending or completed admin OTP session.
 */
export async function resolveAdminOtpSessionState(request?: Request): Promise<AdminOtpSessionState> {
  const otpRequired = isAdminEmailOtpRequired();
  if (request !== undefined && isValidAdminServiceBearer(request.headers.get('authorization'))) {
    return {
      hasAllowlistedSession: true,
      email: null,
      otpRequired,
      otpVerified: true,
      viaServiceToken: true,
    };
  }
  if (allowDevAdminOpen()) {
    return {
      hasAllowlistedSession: true,
      email: null,
      otpRequired,
      otpVerified: true,
      viaServiceToken: false,
    };
  }
  const session = await auth();
  const email = session?.user?.email ?? null;
  const hasAllowlistedSession = email !== null && isAdminEmailAllowed(email);
  const otpVerified = !otpRequired || session?.user?.otpVerified === true;
  return {
    hasAllowlistedSession,
    email,
    otpRequired,
    otpVerified,
    viaServiceToken: false,
  };
}

/**
 * Returns true when OAuth succeeded but email OTP is still required.
 */
export function isAdminOtpPending(state: AdminOtpSessionState): boolean {
  return state.hasAllowlistedSession && state.otpRequired && !state.otpVerified && !state.viaServiceToken;
}

/**
 * Returns true when the request may access protected admin routes.
 */
export function isAdminFullyAuthorized(state: AdminOtpSessionState): boolean {
  if (state.viaServiceToken || allowDevAdminOpen()) {
    return true;
  }
  return state.hasAllowlistedSession && state.otpVerified;
}

export type AdminPendingOtpAccessResult =
  | { readonly authorized: true; readonly email: string }
  | { readonly authorized: false; readonly response: NextResponse };

/**
 * Ensures the request has OAuth access that still needs email OTP verification.
 */
export async function requireAdminPendingOtpSession(request: Request): Promise<AdminPendingOtpAccessResult> {
  const state = await resolveAdminOtpSessionState(request);
  if (!state.otpRequired) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Email OTP is not enabled', code: 'admin_otp_disabled' },
        { status: 404 },
      ),
    };
  }
  if (isAdminFullyAuthorized(state)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Email already verified', code: 'admin_otp_already_verified' },
        { status: 409 },
      ),
    };
  }
  if (!isAdminOtpPending(state) || state.email === null) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'admin_session_required' },
        { status: 401 },
      ),
    };
  }
  return { authorized: true, email: state.email };
}
