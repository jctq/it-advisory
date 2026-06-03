import 'server-only';
import { isTurnstileConfigured, readTurnstileSecretKey } from '@/lib/server/turnstile-config';
import { resolveRateLimitIdentifier } from '@/lib/server/rate-limit-policy';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';
import { NextResponse } from 'next/server';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type TurnstileVerifyResponse = {
  readonly success?: boolean;
};

function readClientIpFromRequest(request: Request): string | undefined {
  const identifier = resolveRateLimitIdentifier(request);
  if (identifier.startsWith('ip:')) {
    return identifier.slice(3);
  }
  return undefined;
}

/**
 * Verifies a Turnstile token with Cloudflare. Returns false when misconfigured or invalid.
 */
export async function verifyTurnstileToken(input: {
  readonly token: string;
  readonly request: Request;
}): Promise<boolean> {
  if (!isTurnstileConfigured()) {
    return true;
  }
  const secret = readTurnstileSecretKey();
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', input.token);
  const remoteIp = readClientIpFromRequest(input.request);
  if (remoteIp !== undefined) {
    body.set('remoteip', remoteIp);
  }
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    return false;
  }
  const payload = (await response.json()) as TurnstileVerifyResponse;
  return payload.success === true;
}

export type TurnstileSkipReason = 'native_client' | 'not_configured';

/**
 * Native clients and dev without keys skip Turnstile; web requests require verification when configured.
 */
export function resolveTurnstileSkipReason(input: {
  readonly source?: 'native' | 'web';
  readonly returnSessionToken?: boolean;
}): TurnstileSkipReason | null {
  if (!isTurnstileConfigured()) {
    return 'not_configured';
  }
  if (input.source === 'native' || input.returnSessionToken === true) {
    return 'native_client';
  }
  return null;
}

/**
 * Validates Turnstile when enforcement is active; returns an error response or null when OK / skipped.
 */
export async function assertTurnstileTokenOrResponse(input: {
  readonly request: Request;
  readonly token: string | null | undefined;
  readonly skipReason: TurnstileSkipReason | null;
}): Promise<NextResponse | null> {
  if (input.skipReason !== null) {
    return null;
  }
  const trimmed = input.token?.trim() ?? '';
  if (trimmed.length === 0) {
    return NextResponse.json(
      { error: 'Complete the security check and try again.', code: 'turnstile_required' },
      { status: 400 },
    );
  }
  const verified = await verifyTurnstileToken({ token: trimmed, request: input.request });
  if (!verified) {
    void recordSecurityEvent({
      type: 'turnstile_failed',
      request: input.request,
      path: new URL(input.request.url).pathname,
      outcome: 'blocked',
    }).catch(() => undefined);
    return NextResponse.json(
      { error: 'Security check failed. Refresh the page and try again.', code: 'turnstile_failed' },
      { status: 403 },
    );
  }
  return null;
}
