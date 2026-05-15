/** Short, human-friendly booking reference for guest lookup and account UI (last 8 hex chars). */
export function formatBookingReferenceId(bookingId: string): string {
  const normalized = bookingId.replace(/\s/g, '').toLowerCase();
  if (normalized.length >= 8) {
    return normalized.slice(-8).toUpperCase();
  }
  return normalized.toUpperCase();
}

export function normalizeBookingReferenceInput(input: string): string {
  return input.replace(/\s/g, '').toUpperCase();
}

export function normalizeGuestManageEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function matchesPhoneLastFour(phone: string, lastFourInput: string): boolean {
  const digits = normalizePhoneDigits(phone);
  const suffix = normalizePhoneDigits(lastFourInput);
  if (suffix.length !== 4) {
    return false;
  }
  return digits.length >= 4 && digits.endsWith(suffix);
}
