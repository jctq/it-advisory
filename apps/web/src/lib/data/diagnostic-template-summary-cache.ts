import { z } from 'zod';
import { COLLECTIONS } from '@/domain/collections';
import type {
  DiagnosticTemplateSummaryCacheDocument,
  DiagnosticTemplateSummaryCachedPayload,
} from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import type { DiagnosticRoundForThread } from '@/lib/marketing/diagnostic-thread';
import {
  computeDiagnosticThreadHash,
  formatDiagnosticThread,
  normalizeDiagnosticThreadText,
} from '@/lib/marketing/diagnostic-thread';
import {
  isDiagnosticCacheEnabled,
  resolveDiagnosticCacheVersion,
} from '@/lib/data/diagnostic-round-cache';
import { resolveProjectRescueGoodFitBullets } from '@it-advisory/diagnostic-core/project-rescue-service-context';

const cachedResponseSchema = z.object({
  summaryForAdvisor: z.string(),
  briefAssessment: z.string(),
  sessionTitle: z.string(),
  mappedSituation: z.string(),
  goodFitBullets: z.array(z.string()).length(3).optional(),
});

/**
 * Stable key: template name + same transcript shape as `/api/quiz/diagnostic-round` uses for hashing.
 */
export function buildTemplateSummaryCacheKey(params: {
  readonly templateName: string;
  readonly initialPrompt: string;
  readonly rounds: readonly DiagnosticRoundForThread[];
}): { readonly normalizedThread: string; readonly threadHash: string; readonly cacheVersion: string } {
  const cacheVersion = resolveDiagnosticCacheVersion();
  const rawThread = `Template funnel: ${params.templateName.trim()}\n${formatDiagnosticThread(
    params.initialPrompt,
    params.rounds,
  )}`;
  const normalizedThread = normalizeDiagnosticThreadText(rawThread);
  const threadHash = computeDiagnosticThreadHash(cacheVersion, normalizedThread);
  return { normalizedThread, threadHash, cacheVersion };
}

export type DiagnosticTemplateSummaryCacheHit = {
  readonly payload: DiagnosticTemplateSummaryCachedPayload;
  readonly model: string;
  readonly documentThreadHash: string;
};

export async function findValidDiagnosticTemplateSummaryCache(
  threadHash: string,
): Promise<DiagnosticTemplateSummaryCacheHit | null> {
  if (!isDiagnosticCacheEnabled()) {
    return null;
  }
  let doc: DiagnosticTemplateSummaryCacheDocument | null;
  try {
    const db = await getDb();
    doc = await db
      .collection<DiagnosticTemplateSummaryCacheDocument>(COLLECTIONS.diagnosticTemplateSummaryCache)
      .findOne({ threadHash });
  } catch (err: unknown) {
    console.error('[diagnostic-template-summary-cache] find failed', err);
    return null;
  }
  if (doc === null) {
    return null;
  }
  const parsed = cachedResponseSchema.safeParse(doc.response);
  if (!parsed.success) {
    console.warn('[diagnostic-template-summary-cache] invalid stored payload for', threadHash);
    return null;
  }
  const data = parsed.data;
  const payload: DiagnosticTemplateSummaryCachedPayload = {
    summaryForAdvisor: data.summaryForAdvisor,
    briefAssessment: data.briefAssessment,
    sessionTitle: data.sessionTitle,
    mappedSituation: data.mappedSituation,
    goodFitBullets: resolveProjectRescueGoodFitBullets(data.goodFitBullets),
  };
  return {
    payload,
    model: doc.model,
    documentThreadHash: doc.threadHash,
  };
}

export async function incrementDiagnosticTemplateSummaryCacheHit(threadHash: string): Promise<void> {
  if (!isDiagnosticCacheEnabled()) {
    return;
  }
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection<DiagnosticTemplateSummaryCacheDocument>(COLLECTIONS.diagnosticTemplateSummaryCache).updateOne(
      { threadHash },
      { $inc: { hitCount: 1 }, $set: { updatedAt: now } },
    );
  } catch (err: unknown) {
    console.error('[diagnostic-template-summary-cache] hit increment failed', err);
  }
}

export async function upsertDiagnosticTemplateSummaryCache(input: {
  readonly threadHash: string;
  readonly cacheVersion: string;
  readonly templateName: string;
  readonly normalizedThread: string;
  readonly model: string;
  readonly response: DiagnosticTemplateSummaryCachedPayload;
}): Promise<void> {
  if (!isDiagnosticCacheEnabled()) {
    return;
  }
  const now = new Date();
  try {
    const db = await getDb();
    await db.collection<DiagnosticTemplateSummaryCacheDocument>(COLLECTIONS.diagnosticTemplateSummaryCache).updateOne(
      { threadHash: input.threadHash },
      {
        $set: {
          cacheVersion: input.cacheVersion,
          templateName: input.templateName,
          normalizedThread: input.normalizedThread,
          model: input.model,
          response: input.response,
          updatedAt: now,
        },
        $setOnInsert: {
          threadHash: input.threadHash,
          createdAt: now,
          hitCount: 0,
        },
      },
      { upsert: true },
    );
  } catch (err: unknown) {
    console.error('[diagnostic-template-summary-cache] upsert failed', err);
  }
}
