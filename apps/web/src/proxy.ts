import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdminEmailAllowed } from '@/lib/server/admin-allowed-emails';
import { isAdminEmailOtpRequired } from '@/lib/server/admin-email-otp-config';
import {
  isAdminFullyAuthorized,
  isAdminOtpPending,
  resolveAdminOtpSessionState,
} from '@/lib/server/admin-otp-session';
import { isValidAdminServiceBearer } from '@/lib/server/admin-service-token';
import { isProductionNodeEnv } from '@/lib/server/is-production-node-env';

const LOGIN_PATH = '/admin/login';
const AUTH_ERROR_PATH = '/admin/auth-error';
const VERIFY_OTP_PATH = '/admin/verify-otp';
const LOGIN_API_PATH = '/api/admin/login';
const LOGOUT_API_PATH = '/api/admin/logout';
const OTP_SEND_API_PATH = '/api/admin/otp/send';
const OTP_VERIFY_API_PATH = '/api/admin/otp/verify';
const ADMIN_PREFIX = '/admin';
const ADMIN_API_PREFIX = '/api/admin';
const APPEARANCE_SCOPE_HEADER = 'x-teqmd-appearance-scope';
const DEFAULT_ADMIN_NEXT_PATH = '/admin/diagnostic-templates';

function isApiAdminPath(pathname: string): boolean {
  return pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`);
}

function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`) || isApiAdminPath(pathname)
  );
}

function isLoginPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    pathname === AUTH_ERROR_PATH ||
    pathname === LOGIN_API_PATH ||
    pathname === LOGOUT_API_PATH
  );
}

function isOtpFlowPath(pathname: string): boolean {
  return (
    pathname === VERIFY_OTP_PATH ||
    pathname === OTP_SEND_API_PATH ||
    pathname === OTP_VERIFY_API_PATH
  );
}

function allowDevAdminOpen(): boolean {
  return !isProductionNodeEnv() && process.env.ALLOW_DEV_ADMIN_OPEN?.trim() === '1';
}

function denyApi(
  code: 'admin_session_required' | 'admin_otp_required' = 'admin_session_required',
): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', code }, { status: 401 });
}

function denyWeb(request: NextRequest, pathname: string = LOGIN_PATH): NextResponse {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = pathname;
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

function continueWithAppearanceScope(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const scope = request.nextUrl.pathname.startsWith('/admin') ? 'admin' : 'marketing';
  requestHeaders.set(APPEARANCE_SCOPE_HEADER, scope);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function isAdminOAuthConfigured(): boolean {
  const googleId = process.env.AUTH_GOOGLE_ID?.trim() ?? '';
  const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? '';
  const microsoftId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ?? '';
  const microsoftSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ?? '';
  const hasGoogle = googleId.length > 0 && googleSecret.length > 0;
  const hasMicrosoft = microsoftId.length > 0 && microsoftSecret.length > 0;
  return hasGoogle || hasMicrosoft;
}

function resolveSafeNextPath(rawNext: string | null): string {
  if (
    rawNext === null ||
    rawNext.length === 0 ||
    !rawNext.startsWith('/admin') ||
    rawNext.startsWith('//')
  ) {
    return DEFAULT_ADMIN_NEXT_PATH;
  }
  return rawNext;
}

async function handleOtpFlowPath(request: NextRequest): Promise<NextResponse> {
  const state = await resolveAdminOtpSessionState(request);
  const { pathname } = request.nextUrl;
  if (isAdminFullyAuthorized(state)) {
    if (pathname === VERIFY_OTP_PATH) {
      const next = resolveSafeNextPath(request.nextUrl.searchParams.get('next'));
      return NextResponse.redirect(new URL(next, request.url));
    }
    return denyApi('admin_session_required');
  }
  if (isAdminOtpPending(state)) {
    return continueWithAppearanceScope(request);
  }
  return isApiAdminPath(pathname) ? denyApi('admin_session_required') : denyWeb(request);
}

/**
 * Next.js 16+ network boundary (Node runtime).
 * Gates admin routes behind NextAuth (allowlisted email) or service Bearer token.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (!isAdminPath(pathname)) {
    return continueWithAppearanceScope(request);
  }
  if (isLoginPath(pathname)) {
    return continueWithAppearanceScope(request);
  }
  if (isOtpFlowPath(pathname)) {
    if (!isAdminEmailOtpRequired()) {
      return isApiAdminPath(pathname)
        ? denyApi('admin_session_required')
        : denyWeb(request, DEFAULT_ADMIN_NEXT_PATH);
    }
    return handleOtpFlowPath(request);
  }
  if (
    !isAdminOAuthConfigured() &&
    !allowDevAdminOpen() &&
    !isValidAdminServiceBearer(request.headers.get('authorization'))
  ) {
    if (isApiAdminPath(pathname)) {
      return NextResponse.json(
        {
          error:
            'Admin OAuth is not configured. Set AUTH_* provider credentials and ADMIN_ALLOWED_EMAILS.',
          code: 'admin_oauth_unset',
        },
        { status: 503 },
      );
    }
    return new NextResponse(
      'Admin OAuth is not configured. Set AUTH_* provider credentials and ADMIN_ALLOWED_EMAILS.',
      {
        status: 503,
      },
    );
  }
  const state = await resolveAdminOtpSessionState(request);
  if (isAdminFullyAuthorized(state)) {
    return continueWithAppearanceScope(request);
  }
  if (isAdminOtpPending(state)) {
    return isApiAdminPath(pathname)
      ? denyApi('admin_otp_required')
      : denyWeb(request, VERIFY_OTP_PATH);
  }
  const session = await auth();
  if (isAdminEmailAllowed(session?.user?.email)) {
    return isApiAdminPath(pathname)
      ? denyApi('admin_otp_required')
      : denyWeb(request, VERIFY_OTP_PATH);
  }
  return isApiAdminPath(pathname) ? denyApi('admin_session_required') : denyWeb(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|scripts/).*)'],
};
