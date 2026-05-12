import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { VISITOR_SESSION_CONFIG } from '@/domain/visitor-session';

export const VISITOR_ID_COOKIE_NAME = 'it_visitor_id';

const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readDeviceVisitorId(request: Request | undefined): string | null {
  const rawDeviceId = request?.headers.get(VISITOR_SESSION_CONFIG.mobileDeviceIdHeaderName)?.trim();
  if (rawDeviceId === undefined || rawDeviceId.length === 0) {
    return null;
  }
  return rawDeviceId.slice(0, VISITOR_SESSION_CONFIG.maxVisitorIdLength);
}

/**
 * Returns the anonymous visitor id from a native device header or HTTP-only cookie.
 */
export async function readOrCreateVisitorId(request?: Request): Promise<string> {
  const deviceVisitorId = readDeviceVisitorId(request);
  if (deviceVisitorId !== null) {
    return deviceVisitorId;
  }
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
