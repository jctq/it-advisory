import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import { findPaymentMethodOption, type PaymentGatewayId, type PaymentTransactionDocument } from '@/domain/payment-types';
import {
  diagnoseAccountBookingPayability,
  diagnoseGuestBookingPayability,
  findVerifiedAccountBookingForCheckout,
  findVerifiedGuestBookingForCheckout,
  type GuestBookingManageCredentials,
  type VerifiedGuestBooking,
} from '@/lib/data/booking-guest-manage';
import {
  buildPayabilityApiExtras,
  evaluateBookingPayability,
} from '@/lib/payments/evaluate-booking-payability';
import { getGatewayCredentials, getPaymentSettings, getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { findPaymentTransactionById, insertPaymentTransaction } from '@/lib/data/payment-transactions';
import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { formatBookingSlotPartsFromStartsAt } from '@/lib/marketing/booking-slot-from-starts-at';
import { encodeQuizSessionRefForMarketingUrl } from '@/lib/server/quiz-session-marketing-ref-crypto';
import { createMockPaymentAdapter, resolvePaymentAdapter } from '@techmd/payments';
import type { CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';
import { getDb } from '@/lib/mongodb';
import { buildPaymentProviderReturnUrls } from '@/lib/payments/payment-provider-return-urls';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';

type ResumeCheckoutParams = {
  readonly credentials: GuestBookingManageCredentials;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
};

type ResumeCheckoutCommonParams = {
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
  /** When set, PSP cancel returns to `/book/[ref]?payment=cancelled` instead of manage booking. */
  readonly sessionMarketingRef?: string;
};

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

export async function createPaymentCheckoutForVerifiedBooking(
  verified: VerifiedGuestBooking,
  params: ResumeCheckoutCommonParams,
): Promise<CreateCheckoutSessionResult> {
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
  const payability = evaluateBookingPayability({
    bookingId: verified.bookingId,
    booking,
    lead,
    paymentPolicy: publicSettings.paymentPolicy,
    paymentsEnabled: publicSettings.paymentsEnabled,
  });
  if (!payability.canPayOnline) {
    return {
      ok: false,
      code: 'booking_not_payable',
      error: payability.reason ?? 'This booking cannot be paid online.',
      ...buildPayabilityApiExtras(payability),
    };
  }
  const leadEmail = typeof lead.email === 'string' ? lead.email.trim() : '';
  const slotParts = formatBookingSlotPartsFromStartsAt(booking.startsAt, booking.timezone);
  const bookingDraftId = verified.bookingId;
  const holdExpiresAt = booking.paymentExpiresAt ?? null;
  const expiresAt =
    settings.paymentPolicy === 'pay_after_hold'
      ? holdExpiresAt ?? new Date(Date.now() + settings.holdExpiresMinutes * 60_000)
      : null;
  let resolvedPricing;
  try {
    resolvedPricing = await resolveCheckoutAmountCentavos({
      serviceKey: booking.serviceKey,
      promoCode: params.promoCode,
      bookingId: verified.bookingId,
      recordingOptIn: booking.recordingOptIn === true,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'promo_invalid',
      error: error instanceof Error ? error.message : 'Invalid promo code.',
    };
  }
  const insertedId = await insertPaymentTransaction({
    gatewayId: params.gatewayId,
    providerRef: bookingDraftId,
    providerSessionId: bookingDraftId,
    paymentPolicy: settings.paymentPolicy,
    amountCentavos: resolvedPricing.amountCentavos,
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
    metadata: {
      bookingDraftId,
      paymentMethodId: params.paymentMethodId,
      resumeBookingId: verified.bookingId,
      pricingSource: resolvedPricing.source,
      ...(resolvedPricing.appliedPromoCode !== undefined
        ? { promoCode: resolvedPricing.appliedPromoCode }
        : {}),
      ...(resolvedPricing.catalogServiceKey !== undefined
        ? { catalogServiceKey: resolvedPricing.catalogServiceKey }
        : {}),
      recordingOptIn: resolvedPricing.recordingOptIn ? 'true' : 'false',
      ...(resolvedPricing.recordingSurchargeCentavos > 0
        ? { recordingSurchargeCentavos: String(resolvedPricing.recordingSurchargeCentavos) }
        : {}),
    },
    expiresAt,
    bookingId: booking._id,
  });
  if (insertedId === null) {
    return { ok: false, code: 'database_unavailable', error: 'Could not create payment session.' };
  }
  const transactionId = insertedId.toString();
  if ((await findPaymentTransactionById(transactionId)) === null) {
    return { ok: false, code: 'database_unavailable', error: 'Could not load payment session.' };
  }
  const gatewayCredentials = await getGatewayCredentials(params.gatewayId);
  const useMock = gatewayCredentials === null && process.env.NODE_ENV === 'development';
  const sessionMarketingRefFromParams = params.sessionMarketingRef?.trim() ?? '';
  const sessionMarketingRefFromBooking =
    booking.quizSessionId !== undefined && booking.quizSessionId !== null
      ? encodeQuizSessionRefForMarketingUrl(booking.quizSessionId.toString())
      : '';
  const sessionMarketingRef =
    sessionMarketingRefFromParams.length > 0 ? sessionMarketingRefFromParams : sessionMarketingRefFromBooking;
  const cancelRelativeUrl =
    sessionMarketingRef.length > 0
      ? `${buildMarketingBookSessionPath(sessionMarketingRef)}?payment=cancelled`
      : '/book/manage?payment=cancelled';
  const { successUrl, cancelUrl } = buildPaymentProviderReturnUrls({
    appBaseUrl: params.appBaseUrl,
    transactionId,
    nativeInAppPaymentReturn: params.nativeInAppPaymentReturn === true,
    cancelRelativeUrl,
    sessionMarketingRef: sessionMarketingRef.length > 0 ? sessionMarketingRef : undefined,
  });
  const adapter =
    useMock
      ? createMockPaymentAdapter(successUrl)
      : gatewayCredentials !== null
        ? resolvePaymentAdapter(params.gatewayId, gatewayCredentials)
        : null;
  if (adapter === null) {
    return { ok: false, code: 'gateway_not_configured', error: 'Payment gateway credentials are not configured.' };
  }
  let providerSession: { readonly providerRef: string; readonly providerSessionId: string; readonly redirectUrl: string };
  try {
    providerSession = await adapter.createCheckoutSession({
      amountCentavos: resolvedPricing.amountCentavos,
      currency: 'PHP',
      description: 'TechMD Consultation Booking',
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
  const refreshed = await findPaymentTransactionById(transactionId);
  if (refreshed !== null) {
    void executeSendBookingPaymentReminderEmail({
      bookingId: verified.bookingId,
      transaction: refreshed,
    });
  }
  return {
    ok: true,
    transactionId,
    redirectUrl: providerSession.redirectUrl,
    bookingId: verified.bookingId,
    manualConfirm: false,
    mock: useMock,
    bookingStatus: verified.booking.status,
  };
}

/**
 * Starts a new gateway checkout for an existing pending booking (guest manage flow).
 */
export async function createPaymentCheckoutForExistingBooking(
  params: ResumeCheckoutParams,
): Promise<CreateCheckoutSessionResult> {
  const verified = await findVerifiedGuestBookingForCheckout(params.credentials);
  if (verified === null) {
    const diagnosis = await diagnoseGuestBookingPayability(params.credentials);
    return {
      ok: false,
      code: 'booking_not_payable',
      error:
        diagnosis.reason ??
        'This booking cannot be paid online. Check your details or contact support.',
      ...buildPayabilityApiExtras(diagnosis),
    };
  }
  return createPaymentCheckoutForVerifiedBooking(verified, {
    gatewayId: params.gatewayId,
    paymentMethodId: params.paymentMethodId,
    paymentMethodLabel: params.paymentMethodLabel,
    appBaseUrl: params.appBaseUrl,
    nativeInAppPaymentReturn: params.nativeInAppPaymentReturn,
    promoCode: params.promoCode,
  });
}

/**
 * Starts checkout for a booking owned by the signed-in marketing account (no guest credential form).
 */
export async function createPaymentCheckoutForAccountBooking(params: {
  readonly bookingId: string;
  readonly visitorId: string;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
}): Promise<CreateCheckoutSessionResult> {
  const verified = await findVerifiedAccountBookingForCheckout(params.bookingId, params.visitorId);
  if (verified === null) {
    const diagnosis = await diagnoseAccountBookingPayability(params.bookingId, params.visitorId);
    return {
      ok: false,
      code: 'booking_not_payable',
      error:
        diagnosis.reason ??
        'This booking cannot be paid online. Check your details or contact support.',
      ...buildPayabilityApiExtras(diagnosis),
    };
  }
  return createPaymentCheckoutForVerifiedBooking(verified, {
    gatewayId: params.gatewayId,
    paymentMethodId: params.paymentMethodId,
    paymentMethodLabel: params.paymentMethodLabel,
    appBaseUrl: params.appBaseUrl,
    nativeInAppPaymentReturn: params.nativeInAppPaymentReturn,
    promoCode: params.promoCode,
  });
}
