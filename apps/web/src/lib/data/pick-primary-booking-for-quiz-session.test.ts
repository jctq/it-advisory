import { describe, expect, it } from 'vitest';
import { pickPrimaryBookingForQuizSession } from './pick-primary-booking-for-quiz-session';

describe('pickPrimaryBookingForQuizSession', () => {
  it('prefers completed over an older pending booking for the same session', () => {
    const pending = {
      status: 'pending' as const,
      updatedAt: new Date('2026-05-28T10:00:00.000Z'),
    };
    const completed = {
      status: 'completed' as const,
      updatedAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    expect(pickPrimaryBookingForQuizSession([pending, completed])).toBe(completed);
  });

  it('breaks ties by most recently updated', () => {
    const olderConfirmed = {
      status: 'confirmed' as const,
      updatedAt: new Date('2026-05-28T10:00:00.000Z'),
    };
    const newerConfirmed = {
      status: 'confirmed' as const,
      updatedAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    expect(pickPrimaryBookingForQuizSession([olderConfirmed, newerConfirmed])).toBe(newerConfirmed);
  });
});
