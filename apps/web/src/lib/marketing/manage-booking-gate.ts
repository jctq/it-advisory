import { NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/data/app-settings';

/**
 * Whether guest manage-booking UI and APIs are enabled (admin diagnostic setting).
 */
export async function readManageBookingEnabled(): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.diagnosticManageBookingEnabled;
}

/**
 * Returns a 403 response when manage booking is disabled, or null when allowed.
 */
export async function assertManageBookingEnabled(): Promise<NextResponse | null> {
  if (!(await readManageBookingEnabled())) {
    return NextResponse.json(
      { error: 'Manage booking is not available.', code: 'manage_booking_disabled' },
      { status: 403 },
    );
  }
  return null;
}
