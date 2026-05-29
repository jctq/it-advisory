import { createHmac, timingSafeEqual } from 'node:crypto';
import { DEFAULT_BOOKING_SESSION_DURATION_MINUTES } from './booking-session-timing';

const TOKEN_VERSION = '1' as const;
const MIN_SECRET_LENGTH = 16 as const;
const POST_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;
const FALLBACK_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type BookingSessionAccessTokenInput = {
  readonly bookingId: string;
  readonly startsAtIso: string;
};

function resolveSigningSecret(): string | null {
  const dedicated = process.env.BOOKING_SESSION_ACCESS_SECRET?.trim() ?? '';
  if (dedicated.length >= MIN_SECRET_LENGTH) {
    return dedicated;
  }
  const quizFallback = process.env.QUIZ_SESSION_URL_SECRET?.trim() ?? '';
  if (quizFallback.length >= MIN_SECRET_LENGTH) {
    return quizFallback;
  }
  return null;
}

/**
 * True when a signing secret is configured so email links can include an access token.
 */
export function canIssueBookingSessionAccessToken(): boolean {
  return resolveSigningSecret() !== null;
}

function resolveTokenExpiresAtMs(startsAtIso: string): number {
  const startsAtMs = Date.parse(startsAtIso.trim());
  if (!Number.isFinite(startsAtMs)) {
    return Date.now() + FALLBACK_TOKEN_TTL_MS;
  }
  const sessionEndMs = startsAtMs + DEFAULT_BOOKING_SESSION_DURATION_MINUTES * 60 * 1000;
  return sessionEndMs + POST_SESSION_GRACE_MS;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Issues a signed, expiring session-room access token for confirmation emails.
 */
export function issueBookingSessionAccessToken(input: BookingSessionAccessTokenInput): string | null {
  const secret = resolveSigningSecret();
  if (secret === null) {
    return null;
  }
  const bookingId = input.bookingId.trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(bookingId)) {
    return null;
  }
  const expiresAtMs = resolveTokenExpiresAtMs(input.startsAtIso);
  const payload = `${TOKEN_VERSION}.${bookingId}.${expiresAtMs}`;
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * Verifies a session-room access token and returns the booking id when valid and unexpired.
 */
export function verifyBookingSessionAccessToken(token: string): { readonly bookingId: string } | null {
  const secret = resolveSigningSecret();
  if (secret === null) {
    return null;
  }
  const trimmed = token.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot >= trimmed.length - 1) {
    return null;
  }
  const payload = trimmed.slice(0, lastDot);
  const signature = trimmed.slice(lastDot + 1);
  if (payload.length === 0 || signature.length === 0) {
    return null;
  }
  if (!verifySignature(payload, signature, secret)) {
    return null;
  }
  const parts = payload.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return null;
  }
  const bookingId = parts[1] ?? '';
  const expiresAtMs = Number.parseInt(parts[2] ?? '', 10);
  if (!/^[a-f0-9]{24}$/.test(bookingId) || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }
  return { bookingId };
}
