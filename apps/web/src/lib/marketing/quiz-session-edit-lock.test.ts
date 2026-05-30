import { describe, expect, it } from 'vitest';
import { isQuizSessionEditingLocked } from './quiz-session-edit-lock';

describe('isQuizSessionEditingLocked', () => {
  it('locks when a booking is linked', () => {
    expect(isQuizSessionEditingLocked({ bookedCount: 1, latestPaymentStatus: null })).toBe(true);
  });

  it('locks after payment succeeds even before booking link', () => {
    expect(isQuizSessionEditingLocked({ bookedCount: 0, latestPaymentStatus: 'paid' })).toBe(true);
  });

  it('locks during checkout', () => {
    expect(isQuizSessionEditingLocked({ bookedCount: 0, latestPaymentStatus: 'processing' })).toBe(true);
  });

  it('allows edits when no booking or payment activity', () => {
    expect(isQuizSessionEditingLocked({ bookedCount: 0, latestPaymentStatus: null })).toBe(false);
  });
});
