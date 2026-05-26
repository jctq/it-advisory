import { describe, expect, it } from 'vitest';
import { resolveBookingAttendeeContact } from './resolve-booking-attendee-contact';

describe('resolveBookingAttendeeContact', () => {
  it('prefers lead email and name when valid', () => {
    const actual = resolveBookingAttendeeContact({
      lead: { name: 'Ana Reyes', email: 'ana@example.com' },
      transaction: { customerEmail: 'other@example.com', customerName: 'Other' },
    });
    expect(actual).toEqual({ email: 'ana@example.com', displayName: 'Ana Reyes' });
  });

  it('falls back to transaction email when lead email is missing', () => {
    const actual = resolveBookingAttendeeContact({
      lead: { name: 'Ana Reyes', email: '—' },
      transaction: { customerEmail: 'pay@example.com', customerName: 'Pay Name' },
    });
    expect(actual).toEqual({ email: 'pay@example.com', displayName: 'Pay Name' });
  });

  it('returns null when no valid email exists', () => {
    const actual = resolveBookingAttendeeContact({
      lead: { name: 'Ana Reyes', email: 'not-an-email' },
      transaction: { customerEmail: null, customerName: null },
    });
    expect(actual).toBeNull();
  });
});
