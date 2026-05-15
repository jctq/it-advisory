import { NextResponse } from 'next/server';
import { authEmailPasswordBodySchema } from '@/lib/marketing/auth-api-schema';
import { mergeVisitorIdentityIntoAccount } from '@/lib/data/merge-visitor-identity';
import { createUserAuthSession } from '@/lib/data/user-auth-sessions';
import { findUserByEmailNormalized, normalizeAccountEmail } from '@/lib/data/users';
import { buildMarketingUserPublicFromDocument } from '@/lib/marketing/marketing-user-public';
import { appendMarketingAuthSessionCookie } from '@/lib/server/marketing-auth-cookie';
import { buildAccountVisitorId } from '@/lib/server/marketing-auth';
import { verifyPasswordPlain } from '@/lib/server/password-credentials';
import { resolveGuestVisitorIdForAuthMerge } from '@/lib/server/marketing-visitor-id';

/**
 * Issues an HTTP-only session cookie for an existing account.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = authEmailPasswordBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const emailNormalized = normalizeAccountEmail(parsed.data.email);
  const user = await findUserByEmailNormalized(emailNormalized);
  if (user === null || !verifyPasswordPlain(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }
  const session = await createUserAuthSession(user._id);
  if (session === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  if (parsed.data.mergeGuestProgress) {
    const guestVisitorId = await resolveGuestVisitorIdForAuthMerge({
      request,
      returnSessionToken: parsed.data.returnSessionToken,
    });
    await mergeVisitorIdentityIntoAccount({
      fromVisitorId: guestVisitorId,
      toAccountVisitorId: buildAccountVisitorId(user._id.toHexString()),
    });
  }
  const jsonBody: {
    ok: true;
    user: ReturnType<typeof buildMarketingUserPublicFromDocument>;
    sessionToken?: string;
    sessionExpiresAt?: string;
  } = {
    ok: true as const,
    user: buildMarketingUserPublicFromDocument(user),
  };
  if (parsed.data.returnSessionToken) {
    jsonBody.sessionToken = session.cookieValue;
    jsonBody.sessionExpiresAt = session.expiresAt.toISOString();
  }
  const response = NextResponse.json(jsonBody);
  appendMarketingAuthSessionCookie(response, session.cookieValue, session.expiresAt);
  return response;
}
