import type { NextResponse } from 'next/server';

export const MARKETING_AUTH_SESSION_COOKIE_NAME = 'it_auth_session';

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Sets the HTTP-only marketing auth session cookie on a route response.
 */
export function appendMarketingAuthSessionCookie(response: NextResponse, cookieValue: string, expiresAt: Date): void {
  response.cookies.set(MARKETING_AUTH_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    expires: expiresAt,
  });
}

/**
 * Clears the marketing auth session cookie.
 */
export function clearMarketingAuthSessionCookie(response: NextResponse): void {
  response.cookies.set(MARKETING_AUTH_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
