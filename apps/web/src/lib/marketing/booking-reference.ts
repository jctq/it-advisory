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

/** Minimum suffix length when matching a booking id by reference input. */
const BOOKING_REFERENCE_SUFFIX_MIN_LENGTH = 4;

/**
 * True when `bookingId` ends with the normalized reference suffix (guest lookup / admin search).
 */
export function bookingIdMatchesReferenceInput(bookingId: string, referenceInput: string): boolean {
  const normalizedReference = normalizeBookingReferenceInput(referenceInput);
  if (normalizedReference.length < BOOKING_REFERENCE_SUFFIX_MIN_LENGTH) {
    return false;
  }
  const normalizedId = bookingId.replace(/\s/g, '').toLowerCase();
  return normalizedId.endsWith(normalizedReference.toLowerCase());
}

/**
 * Returns bookings whose id suffix matches the reference input (may be multiple when input is short).
 */
export function filterBookingsByReferenceInput<T extends { readonly id: string }>(
  bookings: readonly T[],
  referenceInput: string,
): readonly T[] {
  const normalizedReference = normalizeBookingReferenceInput(referenceInput);
  if (normalizedReference.length < BOOKING_REFERENCE_SUFFIX_MIN_LENGTH) {
    return [];
  }
  return bookings.filter((booking) => bookingIdMatchesReferenceInput(booking.id, normalizedReference));
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

function isUsableGuestManageEmail(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') {
    return false;
  }
  const normalized = normalizeGuestManageEmail(raw);
  return normalized.length > 0 && normalized !== '—';
}

/**
 * True when email + phone last four match either the lead or the checkout payment transaction.
 */
export function matchesGuestManageContact(input: {
  readonly email: string;
  readonly phoneLastFour: string;
  readonly leadEmail: string | null | undefined;
  readonly leadPhone: string | null | undefined;
  readonly transactionEmail: string | null | undefined;
  readonly transactionPhone: string | null | undefined;
}): boolean {
  const normalizedEmail = normalizeGuestManageEmail(input.email);
  if (normalizedEmail.length === 0) {
    return false;
  }
  const contactSources: ReadonlyArray<{ readonly email: string | null | undefined; readonly phone: string | null | undefined }> = [
    { email: input.leadEmail, phone: input.leadPhone },
    { email: input.transactionEmail, phone: input.transactionPhone },
  ];
  for (const source of contactSources) {
    if (!isUsableGuestManageEmail(source.email)) {
      continue;
    }
    if (normalizeGuestManageEmail(source.email!) !== normalizedEmail) {
      continue;
    }
    const phone = typeof source.phone === 'string' ? source.phone : '';
    if (matchesPhoneLastFour(phone, input.phoneLastFour)) {
      return true;
    }
  }
  return false;
}
