import { NextResponse } from 'next/server';
import type { DiagnosticRoundCachedPayload, DiagnosticRoundDebugMeta } from '@/domain/types';

export function respondDiagnosticSuccess(
  payload: DiagnosticRoundCachedPayload,
  meta: DiagnosticRoundDebugMeta,
  options: { readonly attachDebugPayload: boolean },
): NextResponse {
  const headers = new Headers();
  headers.set('X-Diagnostic-Source', meta.source);
  headers.set('X-Diagnostic-Match-Tier', meta.matchTier);
  headers.set('X-Diagnostic-Thread-Hash', meta.threadHash);
  headers.set('X-Diagnostic-Query-Thread-Hash', meta.queryThreadHash);
  headers.set('X-Diagnostic-Cache-Version', meta.cacheVersion);
  if (meta.model !== null && meta.model.length > 0) {
    headers.set('X-Diagnostic-Model', meta.model);
  }
  if (meta.semanticScore !== null && Number.isFinite(meta.semanticScore)) {
    headers.set('X-Diagnostic-Semantic-Score', String(meta.semanticScore));
  }
  const body: DiagnosticRoundCachedPayload & { _diagnosticDebug?: DiagnosticRoundDebugMeta } =
    options.attachDebugPayload ? { ...payload, _diagnosticDebug: meta } : payload;
  return NextResponse.json(body, { headers });
}
