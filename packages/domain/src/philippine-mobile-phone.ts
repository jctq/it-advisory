/**
 * Helpers for Philippine (+63) mobile numbers used in marketing profile and booking flows.
 */
const PH_MOBILE_NATIONAL_LENGTH = 10;

/**
 * Strips non-digits and removes a leading trunk zero before a mobile 9 (e.g. "09…" → "9…").
 */
export function normalizePhilippineMobileNationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.replace(/^0+(?=9)/, '').slice(0, PH_MOBILE_NATIONAL_LENGTH);
}

/**
 * Builds E.164 +63 mobile from national digits (10 digits, first digit 9).
 */
export function buildPhilippineMobileE164FromNationalDigits(nationalDigits: string): string | null {
  if (!/^9\d{9}$/.test(nationalDigits)) {
    return null;
  }
  return `+63${nationalDigits}`;
}

/**
 * Parses a stored +63 mobile into national digits for the input field.
 */
export function parseNationalDigitsFromStoredPhone(stored: string | null | undefined): string {
  if (stored === undefined || stored === null) {
    return '';
  }
  const trimmed = stored.trim();
  const match = /^\+63(9\d{9})$/.exec(trimmed);
  if (match?.[1] !== undefined) {
    return match[1];
  }
  return '';
}

/**
 * Accepts E.164 or digit-only variants and returns canonical +639xxxxxxxxx or null.
 */
export function parsePhilippineMobileE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+639\d{9}$/.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('639')) {
    return `+${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`;
  }
  return null;
}
