import { cookies } from 'next/headers';
import { resolveUserAuthSession } from '@/lib/data/user-auth-sessions';
import { findUserById } from '@/lib/data/users';
import { MARKETING_AUTH_SESSION_COOKIE_NAME } from '@/lib/server/marketing-auth-cookie';

export type AuthenticatedMarketingUser = {
  readonly id: string;
  readonly email: string;
};

/**
 * Reads the opaque marketing session token from an `Authorization: Bearer` header.
 */
export function readBearerMarketingSessionToken(request: Request | undefined): string | null {
  if (request === undefined) {
    return null;
  }
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (match === null || match[1] === undefined) {
    return null;
  }
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function resolveAuthenticatedUserFromSessionValue(
  sessionValue: string | undefined,
): Promise<AuthenticatedMarketingUser | null> {
  const resolved = await resolveUserAuthSession(sessionValue);
  if (resolved === null) {
    return null;
  }
  const user = await findUserById(resolved.userId);
  if (user === null) {
    return null;
  }
  return { id: user._id.toHexString(), email: user.emailNormalized };
}

/**
 * Returns the signed-in marketing user from a Bearer token (native) or auth cookie (web), if valid.
 * Bearer wins when both are present and valid.
 */
export async function getAuthenticatedMarketingUser(
  request?: Request,
): Promise<AuthenticatedMarketingUser | null> {
  const bearer = readBearerMarketingSessionToken(request);
  if (bearer !== null) {
    const fromBearer = await resolveAuthenticatedUserFromSessionValue(bearer);
    if (fromBearer !== null) {
      return fromBearer;
    }
  }
  const jar = await cookies();
  const cookieRaw = jar.get(MARKETING_AUTH_SESSION_COOKIE_NAME)?.value;
  return resolveAuthenticatedUserFromSessionValue(cookieRaw);
}

/**
 * Builds the stable `quiz_sessions.visitorId` value for a signed-in account.
 */
export function buildAccountVisitorId(userIdHex: string): string {
  return `acct:${userIdHex}`;
}
