import { VISITOR_SESSION_CONFIG } from '@/domain/visitor-session';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { readOrCreateVisitorId, readVisitorCookieIfPresent } from '@/lib/server/visitor-cookie';

function readDeviceVisitorId(request: Request | undefined): string | null {
  const rawDeviceId = request?.headers.get(VISITOR_SESSION_CONFIG.mobileDeviceIdHeaderName)?.trim();
  if (rawDeviceId === undefined || rawDeviceId.length === 0) {
    return null;
  }
  return rawDeviceId.slice(0, VISITOR_SESSION_CONFIG.maxVisitorIdLength);
}

/**
 * Resolves the anonymous visitor id to merge into an account on login/register.
 * Native clients set `returnSessionToken` and send `x-device-id`; web clients use the visitor cookie.
 */
export async function resolveGuestVisitorIdForAuthMerge(params: {
  readonly request: Request;
  readonly returnSessionToken: boolean;
}): Promise<string | null> {
  if (params.returnSessionToken) {
    return readDeviceVisitorId(params.request);
  }
  return readVisitorCookieIfPresent();
}

/**
 * Visitor key used for quiz, bookings, and leads: signed-in account (cookie or Bearer) wins,
 * then native device id, then anonymous browser cookie visitor.
 */
export async function resolveMarketingVisitorId(request?: Request): Promise<string> {
  const authUser = await getAuthenticatedMarketingUser(request);
  if (authUser !== null) {
    return buildAccountVisitorId(authUser.id);
  }
  const deviceVisitorId = readDeviceVisitorId(request);
  if (deviceVisitorId !== null) {
    return deviceVisitorId;
  }
  return readOrCreateVisitorId(request);
}
