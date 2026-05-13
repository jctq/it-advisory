import { NextResponse } from 'next/server';
import {
  getPublicActiveDiagnosticTemplate,
  getPublicDiagnosticTemplateById,
} from '@/lib/data/diagnostic-templates';
import { findLatestQuizSession, findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';
import { resolveMarketingVisitorId } from '@/lib/server/marketing-visitor-id';
import { resolveQuizSessionObjectIdHexFromMarketingRef } from '@/lib/server/quiz-session-marketing-ref-crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const visitorId = await resolveMarketingVisitorId(request);
    const rawSessionId = new URL(request.url).searchParams.get('sessionId')?.trim() ?? '';
    let session;
    if (rawSessionId.length > 0) {
      const objectIdHex = resolveQuizSessionObjectIdHexFromMarketingRef(rawSessionId);
      if (objectIdHex === null) {
        return NextResponse.json({ error: 'Invalid sessionId', code: 'quiz_session_invalid_id' }, { status: 400 });
      }
      session = await findQuizSessionForVisitor(visitorId, objectIdHex);
      if (session === null) {
        return NextResponse.json({ error: 'Session not found', code: 'quiz_session_not_found' }, { status: 404 });
      }
    } else {
      session = await findLatestQuizSession(visitorId);
    }
    let template = null;
    if (session !== null && session.diagnosticTemplateId !== undefined && session.diagnosticTemplateId !== null) {
      template = await getPublicDiagnosticTemplateById(session.diagnosticTemplateId.toString());
    }
    if (template === null) {
      template = await getPublicActiveDiagnosticTemplate();
    }
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load active diagnostic template.', details: message }, { status: 500 });
  }
}
