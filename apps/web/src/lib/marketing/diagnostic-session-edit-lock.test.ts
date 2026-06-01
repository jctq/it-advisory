import { describe, expect, it } from 'vitest';
import { isDiagnosticSessionEditingLocked } from './diagnostic-session-edit-lock';

describe('isDiagnosticSessionEditingLocked', () => {
  it('locks when a booking is linked', () => {
    expect(isDiagnosticSessionEditingLocked({ bookedCount: 1, latestPaymentStatus: null })).toBe(true);
  });

  it('locks after payment succeeds even before booking link', () => {
    expect(isDiagnosticSessionEditingLocked({ bookedCount: 0, latestPaymentStatus: 'paid' })).toBe(true);
  });

  it('locks during checkout', () => {
    expect(isDiagnosticSessionEditingLocked({ bookedCount: 0, latestPaymentStatus: 'processing' })).toBe(true);
  });

  it('allows edits when no booking or payment activity', () => {
    expect(isDiagnosticSessionEditingLocked({ bookedCount: 0, latestPaymentStatus: null })).toBe(false);
  });
});
