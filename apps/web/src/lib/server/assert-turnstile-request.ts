import 'server-only';
import { NextResponse } from 'next/server';
import {
  assertTurnstileTokenOrResponse,
  resolveTurnstileSkipReason,
} from '@/lib/server/verify-turnstile-token';

/**
 * Validates an optional Turnstile token from a JSON API body.
 */
export async function assertTurnstileFromJsonBodyOrResponse(input: {
  readonly request: Request;
  readonly body: Record<string, unknown>;
  readonly skipReason?: ReturnType<typeof resolveTurnstileSkipReason>;
}): Promise<NextResponse | null> {
  const token = typeof input.body.turnstileToken === 'string' ? input.body.turnstileToken : null;
  const skipReason = input.skipReason ?? resolveTurnstileSkipReason({});
  return assertTurnstileTokenOrResponse({ request: input.request, token, skipReason });
}

/**
 * Validates an optional Turnstile token from multipart form data.
 */
export async function assertTurnstileFromFormDataOrResponse(input: {
  readonly request: Request;
  readonly formData: FormData;
  readonly skipReason?: ReturnType<typeof resolveTurnstileSkipReason>;
}): Promise<NextResponse | null> {
  const entry = input.formData.get('turnstileToken');
  const token = typeof entry === 'string' ? entry : null;
  const skipReason = input.skipReason ?? resolveTurnstileSkipReason({});
  return assertTurnstileTokenOrResponse({ request: input.request, token, skipReason });
}
