import { describe, expect, it } from 'vitest';
import {
  bookingIdMatchesReferenceInput,
  filterBookingsByReferenceInput,
  formatBookingReferenceId,
} from './booking-reference';

describe('bookingIdMatchesReferenceInput', () => {
  const bookingId = '674a1b2c3d4e5f6789012345';

  it('matches full 8-character reference', () => {
    const reference = formatBookingReferenceId(bookingId);
    expect(bookingIdMatchesReferenceInput(bookingId, reference)).toBe(true);
  });

  it('matches case-insensitive input with spaces', () => {
    expect(bookingIdMatchesReferenceInput(bookingId, '90 12 345')).toBe(true);
  });

  it('rejects inputs shorter than four characters', () => {
    expect(bookingIdMatchesReferenceInput(bookingId, '123')).toBe(false);
  });

  it('rejects non-matching suffix', () => {
    expect(bookingIdMatchesReferenceInput(bookingId, '00000000')).toBe(false);
  });
});

describe('filterBookingsByReferenceInput', () => {
  const bookings = [
    { id: '674a1b2c3d4e5f6789012345' },
    { id: '674a1b2c3d4e5f67890abcd' },
  ] as const;

  it('returns all bookings sharing the same suffix', () => {
    const actual = filterBookingsByReferenceInput(bookings, '12345');
    expect(actual).toHaveLength(1);
    expect(actual[0]?.id).toBe('674a1b2c3d4e5f6789012345');
  });

  it('returns empty for short input', () => {
    expect(filterBookingsByReferenceInput(bookings, '12')).toEqual([]);
  });
});
