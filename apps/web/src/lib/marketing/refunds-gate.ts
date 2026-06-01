import { NextResponse } from 'next/server';
import { getPaymentSettings } from '@/lib/data/payment-settings';

/** Whether customer-initiated booking refunds are enabled (admin payment settings). */
export async function readRefundsEnabled(): Promise<boolean> {
  const settings = await getPaymentSettings();
  return settings.refundsEnabled;
}

/** Payment policy and refund toggle for customer cancel/refund actions. */
export async function readCustomerBookingActionSettings(): Promise<{
  readonly paymentPolicy: Awaited<ReturnType<typeof getPaymentSettings>>['paymentPolicy'];
  readonly refundsEnabled: boolean;
}> {
  const settings = await getPaymentSettings();
  return {
    paymentPolicy: settings.paymentPolicy,
    refundsEnabled: settings.refundsEnabled,
  };
}

/** Returns a 403 response when refunds are disabled, or null when allowed. */
export async function assertRefundsEnabled(): Promise<NextResponse | null> {
  if (!(await readRefundsEnabled())) {
    return NextResponse.json(
      { error: 'Booking refunds are not available.', code: 'refunds_disabled' },
      { status: 403 },
    );
  }
  return null;
}
