import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonApiValidationError } from '@/lib/server/api-error-response';
import {
  dispatchPaymentReminderForAccountManageCheckout,
  dispatchPaymentReminderForGuestManageCheckout,
} from '@/lib/payments/dispatch-payment-reminder-for-manage-checkout';
import { guestBookingManageCredentialsSchema } from '@/lib/marketing/guest-booking-manage-schema';
import { assertManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

const transactionIdSchema = z.string().trim().regex(/^[a-f\d]{24}$/i);

const guestBodySchema = guestBookingManageCredentialsSchema.extend({
  transactionId: transactionIdSchema,
});

const accountBodySchema = z.object({
  bookingId: transactionIdSchema,
  transactionId: transactionIdSchema,
});

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = await executeRateLimitOrResponse(request, 'payment_checkout_session');
  if (rateLimited !== null) {
    return rateLimited;
  }
  const disabledResponse = await assertManageBookingEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const accountParsed = accountBodySchema.safeParse(json);
  if (accountParsed.success) {
    const user = await getAuthenticatedMarketingUser(request);
    if (user === null) {
      return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
    }
    const result = await dispatchPaymentReminderForAccountManageCheckout({
      bookingId: accountParsed.data.bookingId,
      visitorId: buildAccountVisitorId(user.id),
      transactionId: accountParsed.data.transactionId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: 'Payment session not found.', code: result.code }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }
  const guestParsed = guestBodySchema.safeParse(json);
  if (!guestParsed.success) {
    return jsonApiValidationError(guestParsed.error);
  }
  const result = await dispatchPaymentReminderForGuestManageCheckout({
    credentials: {
      bookingReference: guestParsed.data.bookingReference,
      email: guestParsed.data.email,
      phoneLastFour: guestParsed.data.phoneLastFour,
    },
    transactionId: guestParsed.data.transactionId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: 'Payment session not found.', code: result.code }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
