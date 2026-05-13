import { NextResponse } from 'next/server';

/**
 * Booking rows are CRM records: the app never deletes them via API or data helpers.
 * This handler documents and enforces that policy for any client that issues DELETE.
 */
export function DELETE(): NextResponse {
  return NextResponse.json(
    { error: 'Booking records cannot be deleted.', code: 'booking_delete_forbidden' },
    { status: 403 },
  );
}
