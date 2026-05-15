import { NextResponse } from 'next/server';
import { authEmailPasswordBodySchema } from '@/lib/marketing/auth-api-schema';
import { mergeVisitorIdentityIntoAccount } from '@/lib/data/merge-visitor-identity';
import { createUserAuthSession } from '@/lib/data/user-auth-sessions';
import { buildMarketingUserPublicFromNewAccount } from '@/lib/marketing/marketing-user-public';
import { insertUserAccount, normalizeAccountEmail } from '@/lib/data/users';
import { appendMarketingAuthSessionCookie } from '@/lib/server/marketing-auth-cookie';
import { buildAccountVisitorId } from '@/lib/server/marketing-auth';
import { resolveGuestVisitorIdForAuthMerge } from '@/lib/server/marketing-visitor-id';

/**
 * Creates a marketing account and issues an HTTP-only session cookie.
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
  const userId = await insertUserAccount({
    emailNormalized,
    plainPassword: parsed.data.password,
  });
  if (userId === null) {
    return NextResponse.json(
      { error: 'Could not create an account. The email may already be registered or the database is unavailable.' },
      { status: 409 },
    );
  }
  const session = await createUserAuthSession(userId);
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
      toAccountVisitorId: buildAccountVisitorId(userId.toHexString()),
    });
  }
  const jsonBody: {
    ok: true;
    user: ReturnType<typeof buildMarketingUserPublicFromNewAccount>;
    sessionToken?: string;
    sessionExpiresAt?: string;
  } = {
    ok: true as const,
    user: buildMarketingUserPublicFromNewAccount({ idHex: userId.toHexString(), emailNormalized }),
  };
  if (parsed.data.returnSessionToken) {
    jsonBody.sessionToken = session.cookieValue;
    jsonBody.sessionExpiresAt = session.expiresAt.toISOString();
  }
  const response = NextResponse.json(jsonBody);
  appendMarketingAuthSessionCookie(response, session.cookieValue, session.expiresAt);
  return response;
}
