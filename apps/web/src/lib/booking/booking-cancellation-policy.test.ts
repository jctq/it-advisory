import { describe, expect, it } from 'vitest';
import { BOOKING_CANCELLATION_MIN_HOURS_BEFORE, isBookingCancellationAllowedBeforeStart } from './booking-cancellation-policy';

describe('isBookingCancellationAllowedBeforeStart', () => {
  it('allows cancellation more than 24 hours before start', () => {
    const startsAt = new Date('2026-06-10T12:00:00.000Z');
    const now = new Date('2026-06-08T11:00:00.000Z');
    expect(isBookingCancellationAllowedBeforeStart(startsAt, now)).toBe(true);
  });

  it('rejects cancellation within 24 hours of start', () => {
    const startsAt = new Date('2026-06-10T12:00:00.000Z');
    const now = new Date('2026-06-10T00:00:00.000Z');
    expect(isBookingCancellationAllowedBeforeStart(startsAt, now)).toBe(false);
  });

  it('uses 24 hour constant', () => {
    expect(BOOKING_CANCELLATION_MIN_HOURS_BEFORE).toBe(24);
  });
});
