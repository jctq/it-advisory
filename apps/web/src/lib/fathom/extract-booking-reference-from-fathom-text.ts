import { normalizeBookingReferenceInput } from '@/lib/marketing/booking-reference';

const BOOKING_REFERENCE_HEX_PATTERN = /\b([0-9A-Fa-f]{8})\b/g;

/**
 * Pulls 8-character booking reference tokens from Fathom meeting text (e.g. calendar titles).
 */
export function extractBookingReferenceCandidatesFromFathomText(
  ...texts: readonly string[]
): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const text of texts) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      continue;
    }
    BOOKING_REFERENCE_HEX_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null = BOOKING_REFERENCE_HEX_PATTERN.exec(trimmed);
    while (match !== null) {
      const normalized = normalizeBookingReferenceInput(match[1] ?? '');
      if (normalized.length === 8 && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
      match = BOOKING_REFERENCE_HEX_PATTERN.exec(trimmed);
    }
  }
  return result;
}
