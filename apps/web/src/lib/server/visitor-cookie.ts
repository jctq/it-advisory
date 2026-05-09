import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

export const VISITOR_ID_COOKIE_NAME = 'it_visitor_id';

const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Returns the anonymous visitor id from the HTTP-only cookie, creating the cookie when absent.
 */
export async function readOrCreateVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_ID_COOKIE_NAME)?.value;
  if (existing) {
    return existing;
  }
  const freshId = randomUUID();
  jar.set(VISITOR_ID_COOKIE_NAME, freshId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
  });
  return freshId;
}
