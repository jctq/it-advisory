import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteUserAuthSessionByCookieValue } from '@/lib/data/user-auth-sessions';
import { readBearerMarketingSessionToken } from '@/lib/server/marketing-auth';
import { clearMarketingAuthSessionCookie, MARKETING_AUTH_SESSION_COOKIE_NAME } from '@/lib/server/marketing-auth-cookie';

/**
 * Ends the marketing auth session and clears the HTTP-only cookie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const bearer = readBearerMarketingSessionToken(request);
  const jar = await cookies();
  const cookieRaw = jar.get(MARKETING_AUTH_SESSION_COOKIE_NAME)?.value;
  const sessionValue = bearer ?? cookieRaw;
  await deleteUserAuthSessionByCookieValue(sessionValue);
  const response = NextResponse.json({ ok: true as const });
  clearMarketingAuthSessionCookie(response);
  return response;
}
