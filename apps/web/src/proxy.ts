import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_token';
const LOGIN_PATH = '/admin/login';
const LOGIN_API_PATH = '/api/admin/login';
const ADMIN_PREFIX = '/admin';
const ADMIN_API_PREFIX = '/api/admin';
const APPEARANCE_SCOPE_HEADER = 'x-techmd-appearance-scope';

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function extractBearer(authHeader: string | null): string | null {
  if (authHeader === null) {
    return null;
  }
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = authHeader.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function isApiAdminPath(pathname: string): boolean {
  return pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`);
}

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`) || isApiAdminPath(pathname);
}

function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === LOGIN_API_PATH;
}

function denyApi(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', code: 'admin_token_required' },
    { status: 401 },
  );
}

function denyWeb(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = LOGIN_PATH;
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

function allowDevWithoutToken(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function continueWithAppearanceScope(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const scope = request.nextUrl.pathname.startsWith('/admin') ? 'admin' : 'marketing';
  requestHeaders.set(APPEARANCE_SCOPE_HEADER, scope);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

/**
 * Next.js 16+ network boundary (Node runtime).
 * Sets appearance scope for SSR and gates admin routes behind `ADMIN_TOKEN`.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (!isAdminPath(pathname)) {
    return continueWithAppearanceScope(request);
  }
  if (isLoginPath(pathname)) {
    return continueWithAppearanceScope(request);
  }
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected || expected.length === 0) {
    if (allowDevWithoutToken()) {
      return continueWithAppearanceScope(request);
    }
    if (isApiAdminPath(pathname)) {
      return NextResponse.json(
        { error: 'ADMIN_TOKEN is not configured on the server.', code: 'admin_token_unset' },
        { status: 503 },
      );
    }
    return new NextResponse('Admin gate not configured. Set ADMIN_TOKEN in the environment.', {
      status: 503,
    });
  }
  const cookieToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null;
  const headerToken = extractBearer(request.headers.get('authorization'));
  const provided = cookieToken ?? headerToken;
  if (provided !== null && constantTimeEquals(provided, expected)) {
    return continueWithAppearanceScope(request);
  }
  return isApiAdminPath(pathname) ? denyApi() : denyWeb(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand/|scripts/).*)',
  ],
};
