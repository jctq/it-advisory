import 'server-only';
import { COLLECTIONS } from '@/domain/collections';
import type { RateLimitBucketDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import {
  resolveRateLimitIdentifier,
  resolveRateLimitPolicy,
  type RateLimitScope,
} from '@/lib/server/rate-limit-policy';
import { NextResponse } from 'next/server';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';

export type { RateLimitScope } from '@/lib/server/rate-limit-policy';
export { resolveRateLimitIdentifier, resolveRateLimitPolicy } from '@/lib/server/rate-limit-policy';

export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many requests. Try again later.');
    this.name = 'RateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

/**
 * Increments the sliding-window counter and throws when the limit is exceeded.
 */
export async function assertRateLimit(input: {
  readonly request: Request;
  readonly scope: RateLimitScope;
  readonly limit?: number;
  readonly windowMs?: number;
  readonly identifier?: string;
}): Promise<void> {
  if (!hasMongoUri()) {
    return;
  }
  const policy = resolveRateLimitPolicy(input.scope);
  const limit = input.limit ?? policy.limit;
  const windowMs = input.windowMs ?? policy.windowMs;
  const identifier = input.identifier ?? resolveRateLimitIdentifier(input.request);
  const nowMs = Date.now();
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const expiresAt = new Date(windowStartMs + windowMs);
  const db = await getDb();
  const collection = db.collection<RateLimitBucketDocument>(COLLECTIONS.rateLimitBuckets);
  const filter = { scope: input.scope, identifier, windowStartMs };
  const updated = await collection.findOneAndUpdate(
    filter,
    {
      $inc: { count: 1 },
      $setOnInsert: { scope: input.scope, identifier, windowStartMs, expiresAt },
    },
    { upsert: true, returnDocument: 'after' },
  );
  const count = updated?.count ?? 1;
  if (count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000));
    throw new RateLimitedError(retryAfterSeconds);
  }
}

/**
 * Applies rate limiting for a scope; returns a 429 response when limited.
 */
export async function executeRateLimitOrResponse(
  request: Request,
  scope: RateLimitScope,
  options?: { readonly identifier?: string; readonly limit?: number; readonly windowMs?: number },
): Promise<NextResponse | null> {
  try {
    await assertRateLimit({
      request,
      scope,
      identifier: options?.identifier,
      limit: options?.limit,
      windowMs: options?.windowMs,
    });
    return null;
  } catch (error: unknown) {
    if (error instanceof RateLimitedError) {
      void recordSecurityEvent({
        type: 'rate_limited',
        request,
        path: new URL(request.url).pathname,
        outcome: 'blocked',
        metadata: { scope },
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: error.message,
          code: 'rate_limited',
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
    throw error;
  }
}
