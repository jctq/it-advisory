import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_token';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const DEFAULT_NEXT = '/admin/leads';

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function sanitizeNext(raw: string | null): string {
  if (raw === null || raw.length === 0) {
    return DEFAULT_NEXT;
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return DEFAULT_NEXT;
  }
  return raw;
}

function buildLoginRedirect(request: Request, error: string, next: string): NextResponse {
  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('error', error);
  if (next !== DEFAULT_NEXT) {
    loginUrl.searchParams.set('next', next);
  }
  return NextResponse.redirect(loginUrl, { status: 303 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const tokenRaw = form.get('token');
  const nextRaw = form.get('next');
  const next = sanitizeNext(typeof nextRaw === 'string' ? nextRaw : null);
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected || expected.length === 0) {
    return buildLoginRedirect(request, 'unset', next);
  }
  if (typeof tokenRaw !== 'string' || tokenRaw.length === 0) {
    return buildLoginRedirect(request, 'missing', next);
  }
  if (!constantTimeEquals(tokenRaw, expected)) {
    return buildLoginRedirect(request, 'invalid', next);
  }
  const destination = new URL(next, request.url);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: expected,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
