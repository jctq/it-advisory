import 'server-only';
import { COLLECTIONS } from '@/domain/collections';
import type { SecurityEventDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';
import { resolveRateLimitIdentifier } from '@/lib/server/rate-limit-policy';

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type SecurityEventType =
  | 'admin_login_success'
  | 'admin_login_failure'
  | 'rate_limited'
  | 'cron_unauthorized'
  | 'webhook_signature_failed';

export type SecurityEventOutcome = 'success' | 'failure' | 'blocked';

function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

/**
 * Append-only security audit row (no secrets in metadata).
 */
export async function recordSecurityEvent(input: {
  readonly type: SecurityEventType;
  readonly request?: Request;
  readonly path?: string;
  readonly outcome: SecurityEventOutcome;
  readonly metadata?: Record<string, string>;
}): Promise<void> {
  if (!hasMongoUri()) {
    return;
  }
  const now = new Date();
  const doc: Omit<SecurityEventDocument, '_id'> = {
    type: input.type,
    path: input.path ?? input.request?.url ?? '',
    identifier: input.request !== undefined ? resolveRateLimitIdentifier(input.request) : 'system',
    outcome: input.outcome,
    metadata: input.metadata ?? {},
    createdAt: now,
    expiresAt: new Date(now.getTime() + DEFAULT_TTL_MS),
  };
  const db = await getDb();
  await db.collection<SecurityEventDocument>(COLLECTIONS.securityEvents).insertOne(doc);
}
