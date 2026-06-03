import { NextResponse } from 'next/server';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Sets the HTTP-only admin session cookie on a route response.
 */
export function appendAdminAuthSessionCookie(response: NextResponse, cookieValue: string, expiresAt: Date): void {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });
}

/**
 * Clears the admin session cookie.
 */
export function clearAdminAuthSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
