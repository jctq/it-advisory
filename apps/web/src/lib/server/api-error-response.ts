import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { isProductionNodeEnv } from '@/lib/server/is-production-node-env';

export type JsonApiErrorInput = {
  readonly error: string;
  readonly code?: string;
  readonly status: number;
  readonly details?: string | Record<string, unknown>;
  readonly headers?: Headers;
};

function shouldExposeDetails(status: number): boolean {
  if (!isProductionNodeEnv()) {
    return true;
  }
  if (status < 500) {
    return true;
  }
  return process.env.ALLOW_API_ERROR_DETAILS?.trim() === '1';
}

function serializeDetails(details: string | Record<string, unknown> | undefined): string | Record<string, unknown> | undefined {
  if (details === undefined) {
    return undefined;
  }
  return details;
}

/**
 * JSON error response that omits internal `details` on 5xx in production unless explicitly allowed.
 */
export function jsonApiError(input: JsonApiErrorInput): NextResponse {
  const body: { error: string; code?: string; details?: string | Record<string, unknown> } = { error: input.error };
  if (input.code !== undefined) {
    body.code = input.code;
  }
  const details = serializeDetails(input.details);
  if (details !== undefined && shouldExposeDetails(input.status)) {
    body.details = details;
  }
  return NextResponse.json(body, { status: input.status, headers: input.headers });
}

/**
 * Zod validation failure response (4xx details remain visible in production for form UX).
 */
export function jsonApiValidationError(
  zodError: ZodError,
  input: { readonly error?: string; readonly status?: number; readonly code?: string; readonly headers?: Headers } = {},
): NextResponse {
  return jsonApiError({
    error: input.error ?? 'Validation failed',
    code: input.code,
    status: input.status ?? 400,
    details: zodError.flatten(),
    headers: input.headers,
  });
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Unknown error';
}

/**
 * Maps an unknown thrown value to a sanitized JSON error (5xx hides details in production).
 */
export function jsonApiErrorFromUnknown(
  error: unknown,
  input: { readonly error: string; readonly status: number; readonly code?: string; readonly headers?: Headers },
): NextResponse {
  return jsonApiError({
    error: input.error,
    code: input.code,
    status: input.status,
    details: resolveErrorMessage(error),
    headers: input.headers,
  });
}
