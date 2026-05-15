import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import { findPaymentMethodOption, type PaymentGatewayId, type PaymentTransactionDocument } from '@/domain/payment-types';
import { findVerifiedGuestBookingForCheckout, type GuestBookingManageCredentials } from '@/lib/data/booking-guest-manage';
import { getGatewayCredentials, getPaymentSettings, getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { findPaymentTransactionById, insertPaymentTransaction } from '@/lib/data/payment-transactions';
import { formatBookingSlotPartsFromStartsAt } from '@/lib/marketing/booking-slot-from-starts-at';
import { createMockPaymentAdapter, resolvePaymentAdapter } from '@it-advisory/payments';
import type { CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout';
import { getDb } from '@/lib/mongodb';

type ResumeCheckoutParams = {
  readonly credentials: GuestBookingManageCredentials;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
};

function buildReturnUrls(
  appBaseUrl: string,
  transactionId: string,
): { readonly successUrl: string; readonly cancelUrl: string } {
  const base = appBaseUrl.replace(/\/$/, '');
  return {
    successUrl: `${base}/book/payment/return?transactionId=${encodeURIComponent(transactionId)}`,
    cancelUrl: `${base}/book/manage?payment=cancelled`,
  };
}

async function updateTransactionProvider(
  transactionId: ObjectId,
  input: {
    readonly providerRef: string;
    readonly providerSessionId: string;
    readonly redirectUrl: string;
  },
): Promise<void> {
  const db = await getDb();
  await db.collection<PaymentTransactionDocument>(COLLECTIONS.paymentTransactions).updateOne(
    { _id: transactionId },
    {
      $set: {
        providerRef: input.providerRef,
        providerSessionId: input.providerSessionId,
        redirectUrl: input.redirectUrl,
        updatedAt: new Date(),
      },
    },
  );
}

/**
 * Starts a new gateway checkout for an existing pending booking (guest manage flow).
 */
export async function createPaymentCheckoutForExistingBooking(
  params: ResumeCheckoutParams,
): Promise<CreateCheckoutSessionResult> {
  const verified = await findVerifiedGuestBookingForCheckout(params.credentials);
  if (verified === null) {
    return {
      ok: false,
      code: 'booking_not_payable',
      error: 'This booking cannot be paid online. Check your details or contact support.',
    };
  }
  const publicSettings = await getPaymentSettingsPublicView();
  if (!publicSettings.paymentsEnabled) {
    return { ok: false, code: 'payments_disabled', error: 'Online payments are not enabled.' };
  }
  const gateway = publicSettings.gateways.find((row) => row.id === params.gatewayId);
  if (gateway === undefined) {
    return { ok: false, code: 'gateway_unavailable', error: 'This payment gateway is not available.' };
  }
  const methodOption = findPaymentMethodOption(params.gatewayId, params.paymentMethodId);
  if (methodOption === null) {
    return { ok: false, code: 'payment_method_invalid', error: 'This payment method is not available for the selected gateway.' };
  }
  const settings = await getPaymentSettings();
  const resolvedPaymentMethodLabel = params.paymentMethodLabel ?? methodOption.label;
  const booking = verified.booking;
  const lead = verified.lead;
  const leadEmail = typeof lead.email === 'string' ? lead.email.trim() : '';
  if (leadEmail.length === 0) {
    return { ok: false, code: 'booking_not_payable', error: 'This booking cannot be paid online.' };
  }
  const slotParts = formatBookingSlotPartsFromStartsAt(booking.startsAt, booking.timezone);
  const bookingDraftId = verified.bookingId;
  const holdExpiresAt = booking.paymentExpiresAt ?? null;
  const expiresAt =
    settings.paymentPolicy === 'pay_after_hold'
      ? holdExpiresAt ?? new Date(Date.now() + settings.holdExpiresMinutes * 60_000)
      : null;
  const insertedId = await insertPaymentTransaction({
    gatewayId: params.gatewayId,
    providerRef: bookingDraftId,
    providerSessionId: bookingDraftId,
    paymentPolicy: settings.paymentPolicy,
    amountCentavos: publicSettings.checkoutAmountCentavos,
    visitorId: booking.visitorId,
    bookingDraftId,
    serviceKey: booking.serviceKey,
    startsAt: booking.startsAt,
    timezone: booking.timezone,
    leadId: lead._id,
    customerName: lead.name,
    customerEmail: leadEmail,
    customerCompany: lead.company,
    customerPhone: lead.phone,
    quizSessionIdHex: booking.quizSessionId !== undefined && booking.quizSessionId !== null ? booking.quizSessionId.toString() : null,
    paymentMethodLabel: resolvedPaymentMethodLabel,
    redirectUrl: null,
    metadata: { bookingDraftId, resumeBookingId: verified.bookingId },
    expiresAt,
    bookingId: booking._id,
  });
  if (insertedId === null) {
    return { ok: false, code: 'database_unavailable', error: 'Could not create payment session.' };
  }
  const transactionId = insertedId.toString();
  const row = await findPaymentTransactionById(transactionId);
  if (row === null) {
    return { ok: false, code: 'database_unavailable', error: 'Could not load payment session.' };
  }
  const credentials = await getGatewayCredentials(params.gatewayId);
  const useMock = credentials === null && process.env.NODE_ENV === 'development';
  const { successUrl, cancelUrl } = buildReturnUrls(params.appBaseUrl, transactionId);
  const adapter =
    useMock
      ? createMockPaymentAdapter(successUrl)
      : credentials !== null
        ? resolvePaymentAdapter(params.gatewayId, credentials)
        : null;
  if (adapter === null) {
    return { ok: false, code: 'gateway_not_configured', error: 'Payment gateway credentials are not configured.' };
  }
  let providerSession: { readonly providerRef: string; readonly providerSessionId: string; readonly redirectUrl: string };
  try {
    providerSession = await adapter.createCheckoutSession({
      amountCentavos: publicSettings.checkoutAmountCentavos,
      currency: 'PHP',
      description: 'IT Advisory consultation booking',
      successUrl,
      cancelUrl,
      referenceId: bookingDraftId,
      metadata: {
        transactionId,
        visitorId: booking.visitorId,
        bookingDraftId,
        bookingId: verified.bookingId,
        paymentMethodId: params.paymentMethodId,
        date: slotParts.date,
        time: slotParts.time,
      },
      sandboxMode: settings.sandboxMode,
      paymentMethodId: params.paymentMethodId,
      customerName: lead.name,
      customerEmail: leadEmail,
      customerPhone: typeof lead.phone === 'string' ? lead.phone.trim() : '',
    });
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'gateway_error',
      error: error instanceof Error ? error.message : 'Payment provider error.',
    };
  }
  await updateTransactionProvider(insertedId, providerSession);
  return {
    ok: true,
    transactionId,
    redirectUrl: providerSession.redirectUrl,
    bookingId: verified.bookingId,
    manualConfirm: false,
    mock: useMock,
  };
}
