const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookingAttendeeContact = {
  readonly email: string;
  readonly displayName: string;
};

function isUsableEmail(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed !== '—' && EMAIL_ADDRESS_PATTERN.test(trimmed);
}

/**
 * Resolves the customer email and display name for calendar invites and similar flows.
 */
export function resolveBookingAttendeeContact(input: {
  readonly lead: { readonly name: string; readonly email: string } | null;
  readonly transaction: {
    readonly customerEmail: string | null;
    readonly customerName: string | null;
  } | null;
}): BookingAttendeeContact | null {
  const fromLeadEmail = input.lead?.email?.trim() ?? '';
  if (isUsableEmail(fromLeadEmail)) {
    const leadName = input.lead?.name?.trim() ?? '';
    const txName = input.transaction?.customerName?.trim() ?? '';
    const displayName =
      leadName.length > 0 ? leadName : txName.length > 0 ? txName : 'Guest';
    return { email: fromLeadEmail, displayName };
  }
  const fromTxEmail = input.transaction?.customerEmail?.trim() ?? '';
  if (isUsableEmail(fromTxEmail)) {
    const txName = input.transaction?.customerName?.trim() ?? '';
    const leadName = input.lead?.name?.trim() ?? '';
    const displayName =
      txName.length > 0 ? txName : leadName.length > 0 ? leadName : 'Guest';
    return { email: fromTxEmail, displayName };
  }
  return null;
}
