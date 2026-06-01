export const BOOKING_CANCELLATION_MIN_HOURS_BEFORE = 24 as const;

export function isBookingCancellationAllowedBeforeStart(startsAt: Date, now: Date = new Date()): boolean {
  const cutoffMs = startsAt.getTime() - BOOKING_CANCELLATION_MIN_HOURS_BEFORE * 60 * 60 * 1000;
  return now.getTime() < cutoffMs;
}
