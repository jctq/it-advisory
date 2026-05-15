import type { DiagnosticRoundDebugMeta, DiagnosticRoundMatchTier } from '@techmd/domain/types';

function parseMatchTier(value: string | null): DiagnosticRoundMatchTier | null {
  if (value === 'exact' || value === 'semantic' || value === 'ai') {
    return value;
  }
  return null;
}

function parseSemanticScore(value: string | null): number | null {
  if (value === null || value.length === 0) {
    return null;
  }
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads provenance from response headers (always set on success) or from `_diagnosticDebug` when present.
 */
export function extractDiagnosticRoundDebugFromResponse(
  response: Response,
  data: unknown,
): DiagnosticRoundDebugMeta | null {
  const source = response.headers.get('X-Diagnostic-Source');
  const threadHash = response.headers.get('X-Diagnostic-Thread-Hash');
  const queryThreadHashHeader = response.headers.get('X-Diagnostic-Query-Thread-Hash');
  const cacheVersion = response.headers.get('X-Diagnostic-Cache-Version');
  const modelHeader = response.headers.get('X-Diagnostic-Model');
  const matchTierHeader = response.headers.get('X-Diagnostic-Match-Tier');
  const semanticScoreHeader = response.headers.get('X-Diagnostic-Semantic-Score');
  if (
    (source === 'cache' || source === 'ai') &&
    threadHash !== null &&
    threadHash.length > 0 &&
    cacheVersion !== null &&
    cacheVersion.length > 0
  ) {
    const queryThreadHash =
      queryThreadHashHeader !== null && queryThreadHashHeader.length > 0 ? queryThreadHashHeader : threadHash;
    let matchTier = parseMatchTier(matchTierHeader);
    if (matchTier === null) {
      matchTier = source === 'ai' ? 'ai' : 'exact';
    }
    const semanticScore = parseSemanticScore(semanticScoreHeader);
    return {
      source,
      matchTier,
      threadHash,
      queryThreadHash,
      cacheVersion,
      model: modelHeader !== null && modelHeader.length > 0 ? modelHeader : null,
      semanticScore,
    };
  }
  if (data !== null && typeof data === 'object' && '_diagnosticDebug' in data) {
    const raw = (data as { _diagnosticDebug: unknown })._diagnosticDebug;
    if (raw !== null && typeof raw === 'object') {
      const record = raw as Record<string, unknown>;
      const s = record.source;
      const th = record.threadHash;
      const qth = record.queryThreadHash;
      const cv = record.cacheVersion;
      const m = record.model;
      const tier = record.matchTier;
      const score = record.semanticScore;
      if (
        (s === 'cache' || s === 'ai') &&
        typeof th === 'string' &&
        th.length > 0 &&
        typeof cv === 'string' &&
        cv.length > 0
      ) {
        const parsedTier = typeof tier === 'string' ? parseMatchTier(tier) : null;
        const semanticScore =
          typeof score === 'number' && Number.isFinite(score)
            ? score
            : typeof score === 'string'
              ? parseSemanticScore(score)
              : null;
        return {
          source: s,
          matchTier: parsedTier ?? (s === 'ai' ? 'ai' : 'exact'),
          threadHash: th,
          queryThreadHash: typeof qth === 'string' && qth.length > 0 ? qth : th,
          cacheVersion: cv,
          model: typeof m === 'string' && m.length > 0 ? m : null,
          semanticScore,
        };
      }
    }
  }
  return null;
}
