import { describe, expect, it } from 'vitest';
import { pickPrimaryBookingForDiagnosticSession } from './pick-primary-booking-for-diagnostic-session';

describe('pickPrimaryBookingForDiagnosticSession', () => {
  it('prefers completed over an older pending booking for the same session', () => {
    const pending = {
      status: 'pending' as const,
      updatedAt: new Date('2026-05-28T10:00:00.000Z'),
    };
    const completed = {
      status: 'completed' as const,
      updatedAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    expect(pickPrimaryBookingForDiagnosticSession([pending, completed])).toBe(completed);
  });

  it('prefers a pending booking with an active checkout over a stale expired hold', () => {
    const staleExpired = {
      status: 'pending' as const,
      paymentStatus: 'expired' as const,
      updatedAt: new Date('2026-06-02T12:00:00.000Z'),
    };
    const activeHold = {
      status: 'pending' as const,
      paymentStatus: 'processing' as const,
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    };
    expect(pickPrimaryBookingForDiagnosticSession([staleExpired, activeHold])).toBe(activeHold);
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
    expect(pickPrimaryBookingForDiagnosticSession([olderConfirmed, newerConfirmed])).toBe(newerConfirmed);
  });
});
