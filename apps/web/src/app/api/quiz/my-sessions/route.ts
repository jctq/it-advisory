import { NextResponse } from 'next/server';
import { insertBlankQuizSessionForVisitor, listQuizSessionsForVisitor } from '@/lib/data/quiz-sessions';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';

/**
 * Lists quiz session snapshots for the signed-in marketing account (`acct:<userId>` rows).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const sessions = await listQuizSessionsForVisitor(visitorId);
  return NextResponse.json({ sessions });
}

/**
 * Creates a new empty diagnostic session for the signed-in account and points `visitor_sessions` at it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedMarketingUser(request);
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  const visitorId = buildAccountVisitorId(user.id);
  const sessionId = await insertBlankQuizSessionForVisitor(visitorId);
  if (sessionId === null) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  return NextResponse.json({ sessionId: encodeQuizSessionRefForMarketingUrl(sessionId) });
}
