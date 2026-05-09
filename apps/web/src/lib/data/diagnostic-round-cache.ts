import type { Document } from 'mongodb';
import { z } from 'zod';
import { embedTextForDiagnosticCache } from '@/lib/ai/thread-embedding';
import { COLLECTIONS } from '@/domain/collections';
import type { DiagnosticRoundCacheDocument, DiagnosticRoundCachedPayload } from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import type { DiagnosticRoundForThread } from '@/lib/marketing/diagnostic-thread';
import {
  computeDiagnosticThreadHash,
  formatDiagnosticThread,
  normalizeDiagnosticThreadText,
} from '@/lib/marketing/diagnostic-thread';

const questionBlockCacheSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.string()),
});

const cachedPayloadSchema = z.discriminatedUnion('complete', [
  z.object({
    complete: z.literal(true),
    mappedSituation: z.string(),
    summaryForAdvisor: z.string(),
    guidance: z.string().nullable(),
    questions: z.array(z.never()),
  }),
  z.object({
    complete: z.literal(false),
    guidance: z.string().nullable(),
    questions: z.array(questionBlockCacheSchema).min(1),
  }),
]);

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export function resolveDiagnosticCacheVersion(): string {
  const raw = process.env.DIAGNOSTIC_CACHE_VERSION?.trim();
  return raw && raw.length > 0 ? raw : '1';
}

export function isDiagnosticCacheEnabled(): boolean {
  if (!hasMongoUri()) {
    return false;
  }
  const flag = process.env.DIAGNOSTIC_CACHE_DISABLED?.toLowerCase();
  return flag !== '1' && flag !== 'true' && flag !== 'yes';
}

export function buildDiagnosticCacheKey(
  initialPrompt: string,
  rounds: readonly DiagnosticRoundForThread[],
): { readonly normalizedThread: string; readonly threadHash: string; readonly cacheVersion: string } {
  const cacheVersion = resolveDiagnosticCacheVersion();
  const rawThread = formatDiagnosticThread(initialPrompt, rounds);
  const normalizedThread = normalizeDiagnosticThreadText(rawThread);
  const threadHash = computeDiagnosticThreadHash(cacheVersion, normalizedThread);
  return { normalizedThread, threadHash, cacheVersion };
}

export type DiagnosticRoundCacheHit = {
  readonly payload: DiagnosticRoundCachedPayload;
  readonly model: string;
  readonly documentThreadHash: string;
};

export function resolveDiagnosticVectorIndexName(): string | undefined {
  const raw = process.env.DIAGNOSTIC_CACHE_VECTOR_INDEX_NAME?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function resolveDiagnosticVectorMinScore(): number {
  const raw = process.env.DIAGNOSTIC_CACHE_VECTOR_MIN_SCORE?.trim();
  const n = raw && raw.length > 0 ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.88;
}

export function resolveDiagnosticVectorNumCandidates(): number {
  const raw = process.env.DIAGNOSTIC_CACHE_VECTOR_NUM_CANDIDATES?.trim();
  const n = raw && raw.length > 0 ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 10 ? n : 200;
}

export function isSemanticDiagnosticCacheEnabled(): boolean {
  if (!isDiagnosticCacheEnabled()) {
    return false;
  }
  const disabled = process.env.DIAGNOSTIC_CACHE_SEMANTIC_DISABLED?.toLowerCase();
  if (disabled === '1' || disabled === 'true' || disabled === 'yes') {
    return false;
  }
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }
  const indexName = resolveDiagnosticVectorIndexName();
  return Boolean(indexName);
}

export async function findValidDiagnosticRoundCache(threadHash: string): Promise<DiagnosticRoundCacheHit | null> {
  if (!isDiagnosticCacheEnabled()) {
    return null;
  }
  let doc: DiagnosticRoundCacheDocument | null;
  try {
    const db = await getDb();
    doc = await db
      .collection<DiagnosticRoundCacheDocument>(COLLECTIONS.diagnosticRoundCache)
      .findOne({ threadHash });
  } catch (err: unknown) {
    console.error('[diagnostic-round-cache] find failed', err);
    return null;
  }
  if (doc === null) {
    return null;
  }
  const parsed = cachedPayloadSchema.safeParse(doc.response);
  if (!parsed.success) {
    console.warn('[diagnostic-round-cache] invalid stored payload for', threadHash);
    return null;
  }
  return {
    payload: parsed.data as DiagnosticRoundCachedPayload,
    model: doc.model,
    documentThreadHash: doc.threadHash,
  };
}

export type SemanticDiagnosticRoundCacheHit = DiagnosticRoundCacheHit & {
  readonly similarityScore: number;
};

/**
 * Atlas Vector Search nearest neighbor on `embedding`, filtered by cache version and round depth.
 */
export async function findSemanticDiagnosticRoundCache(input: {
  readonly normalizedThread: string;
  readonly cacheVersion: string;
  readonly roundsCompleted: number;
}): Promise<SemanticDiagnosticRoundCacheHit | null> {
  if (!isSemanticDiagnosticCacheEnabled()) {
    return null;
  }
  const indexName = resolveDiagnosticVectorIndexName();
  if (!indexName) {
    return null;
  }
  let queryVector: readonly number[];
  try {
    const embedded = await embedTextForDiagnosticCache(input.normalizedThread);
    queryVector = embedded.embedding;
  } catch (err: unknown) {
    console.error('[diagnostic-round-cache] embedding query failed', err);
    return null;
  }
  const minScore = resolveDiagnosticVectorMinScore();
  const numCandidates = resolveDiagnosticVectorNumCandidates();
  const pipeline: Document[] = [
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: [...queryVector],
        numCandidates,
        limit: 5,
        filter: {
          cacheVersion: { $eq: input.cacheVersion },
          roundsCompleted: { $eq: input.roundsCompleted },
        },
      },
    },
    {
      $project: {
        threadHash: 1,
        response: 1,
        model: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];
  try {
    const db = await getDb();
    const rows = await db
      .collection<DiagnosticRoundCacheDocument>(COLLECTIONS.diagnosticRoundCache)
      .aggregate<Document>(pipeline)
      .toArray();
    const top = rows[0];
    if (top === undefined || top.threadHash === undefined) {
      return null;
    }
    const scoreRaw = top.score;
    const similarityScore = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : 0;
    if (similarityScore < minScore) {
      return null;
    }
    const parsed = cachedPayloadSchema.safeParse(top.response);
    if (!parsed.success) {
      console.warn('[diagnostic-round-cache] invalid semantic payload for', top.threadHash);
      return null;
    }
    const model =
      typeof top.model === 'string' && top.model.length > 0 ? top.model : 'unknown';
    return {
      payload: parsed.data as DiagnosticRoundCachedPayload,
      model,
      documentThreadHash: top.threadHash,
      similarityScore,
    };
  } catch (err: unknown) {
    console.error('[diagnostic-round-cache] vector search failed', err);
    return null;
  }
}

export async function incrementDiagnosticRoundCacheHit(threadHash: string): Promise<void> {
  if (!isDiagnosticCacheEnabled()) {
    return;
  }
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection<DiagnosticRoundCacheDocument>(COLLECTIONS.diagnosticRoundCache).updateOne(
      { threadHash },
      { $inc: { hitCount: 1 }, $set: { updatedAt: now } },
    );
  } catch (err: unknown) {
    console.error('[diagnostic-round-cache] hit increment failed', err);
  }
}

export async function upsertDiagnosticRoundCache(input: {
  readonly threadHash: string;
  readonly cacheVersion: string;
  readonly normalizedThread: string;
  readonly roundsCompleted: number;
  readonly model: string;
  readonly response: DiagnosticRoundCachedPayload;
}): Promise<void> {
  if (!isDiagnosticCacheEnabled()) {
    return;
  }
  const now = new Date();
  let embedding: readonly number[] | undefined;
  let embeddingModel: string | undefined;
  if (isSemanticDiagnosticCacheEnabled()) {
    try {
      const embedded = await embedTextForDiagnosticCache(input.normalizedThread);
      embedding = embedded.embedding;
      embeddingModel = embedded.model;
    } catch (err: unknown) {
      console.error('[diagnostic-round-cache] embedding upsert failed', err);
    }
  }
  try {
    const db = await getDb();
    const setFields: Record<string, unknown> = {
      cacheVersion: input.cacheVersion,
      normalizedThread: input.normalizedThread,
      roundsCompleted: input.roundsCompleted,
      model: input.model,
      response: input.response,
      updatedAt: now,
    };
    if (embedding !== undefined && embeddingModel !== undefined) {
      setFields.embedding = [...embedding];
      setFields.embeddingModel = embeddingModel;
    }
    await db.collection<DiagnosticRoundCacheDocument>(COLLECTIONS.diagnosticRoundCache).updateOne(
      { threadHash: input.threadHash },
      {
        $set: setFields,
        $setOnInsert: {
          threadHash: input.threadHash,
          createdAt: now,
          hitCount: 0,
        },
      },
      { upsert: true },
    );
  } catch (err: unknown) {
    console.error('[diagnostic-round-cache] upsert failed', err);
  }
}
