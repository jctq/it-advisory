import { timingSafeEqual } from 'node:crypto';
import type { CronTriggerSource } from '@/domain/cron-types';

export type VerifyCronRequestResult =
  | { readonly authorized: true }
  | { readonly authorized: false };

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export function verifyCronRequest(request: Request): VerifyCronRequestResult {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? '';
  if (cronSecret.length === 0) {
    return { authorized: true };
  }
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  if (!constantTimeEquals(header, expected)) {
    return { authorized: false };
  }
  return { authorized: true };
}

export function resolveCronTriggerSource(request: Request): CronTriggerSource {
  const vercelCron = request.headers.get('x-vercel-cron')?.trim() ?? '';
  if (vercelCron === '1') {
    return 'scheduled';
  }
  const railwayCron = request.headers.get('x-railway-cron')?.trim() ?? '';
  if (railwayCron.length > 0) {
    return 'scheduled';
  }
  return 'unknown';
}
