export const DEFAULT_BOOKING_SESSION_DURATION_MINUTES = 60 as const;

/** How long before start the join button becomes available. */
export const BOOKING_SESSION_JOIN_EARLY_MS = 10 * 60 * 1000;

/** When the UI switches from a long countdown to “starting soon”. */
export const BOOKING_SESSION_STARTING_SOON_MS = 15 * 60 * 1000;

export type BookingSessionPhase = 'upcoming' | 'starting-soon' | 'live' | 'ended';

export type BookingSessionTiming = {
  readonly phase: BookingSessionPhase;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
  readonly canJoin: boolean;
};

export type BookingSessionCountdownParts = {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
};

function parseStartsAtMs(startsAtIso: string): number | null {
  const normalized = startsAtIso.trim();
  if (normalized.length === 0) {
    return null;
  }
  const startsAtMs = Date.parse(normalized);
  if (!Number.isFinite(startsAtMs)) {
    return null;
  }
  return startsAtMs;
}

export function resolveBookingSessionTiming(input: {
  readonly startsAtIso: string;
  readonly serverNowMs: number;
  readonly durationMinutes?: number;
}): BookingSessionTiming | null {
  const startsAtMs = parseStartsAtMs(input.startsAtIso);
  if (startsAtMs === null) {
    return null;
  }
  const durationMinutes = input.durationMinutes ?? DEFAULT_BOOKING_SESSION_DURATION_MINUTES;
  const endsAtMs = startsAtMs + durationMinutes * 60 * 1000;
  const msUntilStart = startsAtMs - input.serverNowMs;
  const msUntilEnd = endsAtMs - input.serverNowMs;
  let phase: BookingSessionPhase;
  if (msUntilEnd <= 0) {
    phase = 'ended';
  } else if (msUntilStart <= 0) {
    phase = 'live';
  } else if (msUntilStart <= BOOKING_SESSION_STARTING_SOON_MS) {
    phase = 'starting-soon';
  } else {
    phase = 'upcoming';
  }
  const canJoin =
    msUntilEnd > 0 && msUntilStart <= BOOKING_SESSION_JOIN_EARLY_MS;
  return {
    phase,
    startsAtMs,
    endsAtMs,
    msUntilStart,
    msUntilEnd,
    canJoin,
  };
}

export function buildBookingSessionCountdownParts(msRemaining: number): BookingSessionCountdownParts {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function formatBookingSessionCountdownLabel(parts: BookingSessionCountdownParts): string {
  const segments: string[] = [];
  if (parts.days > 0) {
    segments.push(`${String(parts.days)}d`);
  }
  if (parts.hours > 0 || parts.days > 0) {
    segments.push(`${String(parts.hours).padStart(2, '0')}h`);
  }
  segments.push(`${String(parts.minutes).padStart(2, '0')}m`);
  segments.push(`${String(parts.seconds).padStart(2, '0')}s`);
  return segments.join(' ');
}

export function isBookingSessionEndedByFathom(input: {
  readonly sessionEndedAtIso: string | null;
  readonly bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}): boolean {
  if (input.bookingStatus === 'completed') {
    return true;
  }
  const normalized = input.sessionEndedAtIso?.trim() ?? '';
  return normalized.length > 0;
}

export function resolveBookingSessionDisplayPhase(input: {
  readonly timing: BookingSessionTiming | null;
  readonly sessionEndedAtIso: string | null;
  readonly bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}): BookingSessionPhase {
  if (isBookingSessionEndedByFathom(input)) {
    return 'ended';
  }
  if (input.timing === null) {
    return 'upcoming';
  }
  return input.timing.phase;
}
