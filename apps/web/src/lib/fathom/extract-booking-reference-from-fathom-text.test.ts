import { describe, expect, it } from 'vitest';
import { extractBookingReferenceCandidatesFromFathomText } from './extract-booking-reference-from-fathom-text';

describe('extractBookingReferenceCandidatesFromFathomText', () => {
  it('extracts reference from Meet-style calendar title', () => {
    const actual = extractBookingReferenceCandidatesFromFathomText(
      'TechMD · Project rescue — A1B2C3D4',
    );
    expect(actual).toEqual(['A1B2C3D4']);
  });

  it('deduplicates and normalizes case', () => {
    const actual = extractBookingReferenceCandidatesFromFathomText('ref a1b2c3d4', 'again A1B2C3D4');
    expect(actual).toEqual(['A1B2C3D4']);
  });

  it('returns empty when no 8-char hex token', () => {
    const actual = extractBookingReferenceCandidatesFromFathomText('Consultation · project-rescue');
    expect(actual).toEqual([]);
  });
});
