import { ObjectId } from 'mongodb';
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
import {
  findOpenPaymentTransactionForBooking,
  findPaymentTransactionById,
  insertPaymentTransaction,
} from '@/lib/data/payment-transactions';
import { buildMarketingBookSessionPath } from '@/lib/marketing/diagnostic-session-marketing-ref';
import { formatBookingSlotPartsFromStartsAt } from '@/lib/marketing/booking-slot-from-starts-at';
import { encodeDiagnosticSessionRefForMarketingUrl } from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import type { CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';
import { buildPaymentProviderReturnUrls } from '@/lib/payments/payment-provider-return-urls';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';
import { isOpenPaymentTransactionHoldActive } from '@/lib/marketing/payment-hold-expiry';
import { resumeOpenPaymentTransactionCheckout } from '@/lib/payments/payment-checkout-resume-open';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';
import {
  applyBookingRecordingFieldsFromCheckout,
  resolveCheckoutRecordingOptIn,
} from '@/lib/booking/apply-booking-recording-fields';
import { renewBookingCheckoutHoldFromOpenTransaction } from '@/lib/payments/payment-completion';
import { loadCheckoutPaymentContext } from '@/lib/payments/payment-checkout-context';
import { validateCheckoutGatewayMethod } from '@/lib/payments/validate-checkout-gateway';
import { runProviderCheckout } from '@/lib/payments/run-provider-checkout';
import { updatePaymentTransactionProvider } from '@/lib/payments/update-transaction-provider';
import type { CheckoutTimingCollector } from '@/lib/payments/checkout-timing';

type ResumeCheckoutParams = {
  readonly credentials: GuestBookingManageCredentials;
  readonly gatewayId: import('@/domain/payment-types').PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
  readonly recordingOptIn?: boolean;
  readonly timing?: CheckoutTimingCollector;
};

type ResumeCheckoutCommonParams = {
  readonly gatewayId: import('@/domain/payment-types').PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
  readonly recordingOptIn?: boolean;
  readonly sessionMarketingRef?: string;
  readonly timing?: CheckoutTimingCollector;
};

export async function createPaymentCheckoutForVerifiedBooking(
  verified: VerifiedGuestBooking,
  params: ResumeCheckoutCommonParams,
): Promise<CreateCheckoutSessionResult> {
  const timing = params.timing;
  timing?.mark('settings_load');
  const checkoutContext = await loadCheckoutPaymentContext(params.gatewayId);
  const gatewayValidation = validateCheckoutGatewayMethod({
    context: checkoutContext,
    gatewayId: params.gatewayId,
    paymentMethodId: params.paymentMethodId,
    paymentMethodLabel: params.paymentMethodLabel,
  });
  if (!gatewayValidation.ok) {
    return gatewayValidation;
  }
  const { settings, resolvedPaymentMethodLabel } = gatewayValidation.validated;
  const booking = verified.booking;
  const lead = verified.lead;
  const payability = evaluateBookingPayability({
    bookingId: verified.bookingId,
    booking,
    lead,
    paymentPolicy: settings.paymentPolicy,
    paymentsEnabled: settings.paymentsEnabled,
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
  timing?.mark('open_tx_and_recording');
  const existingOpenTransaction = await findOpenPaymentTransactionForBooking(verified.bookingId);
  const recordingOptIn = resolveCheckoutRecordingOptIn({
    requested: params.recordingOptIn,
    bookingRecordingOptIn: booking.recordingOptIn,
    transactionMetadata:
      existingOpenTransaction !== null && isOpenPaymentTransactionHoldActive(existingOpenTransaction)
        ? existingOpenTransaction.metadata
        : undefined,
  });
  await applyBookingRecordingFieldsFromCheckout({
    bookingId: booking._id,
    recordingOptIn,
  });
  let resolvedPricing;
  try {
    resolvedPricing = await resolveCheckoutAmountCentavos({
      serviceKey: booking.serviceKey,
      promoCode: params.promoCode,
      bookingId: verified.bookingId,
      recordingOptIn,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'promo_invalid',
      error: error instanceof Error ? error.message : 'Invalid promo code.',
    };
  }
  const sessionMarketingRefFromParams = params.sessionMarketingRef?.trim() ?? '';
  const sessionMarketingRefFromBooking =
    booking.diagnosticSessionId !== undefined && booking.diagnosticSessionId !== null
      ? encodeDiagnosticSessionRefForMarketingUrl(booking.diagnosticSessionId.toString())
      : '';
  const sessionMarketingRef =
    sessionMarketingRefFromParams.length > 0 ? sessionMarketingRefFromParams : sessionMarketingRefFromBooking;
  if (existingOpenTransaction !== null && isOpenPaymentTransactionHoldActive(existingOpenTransaction)) {
    return resumeOpenPaymentTransactionCheckout({
      transaction: existingOpenTransaction,
      visitorId: booking.visitorId,
      gatewayId: params.gatewayId,
      paymentMethodId: params.paymentMethodId,
      paymentMethodLabel: resolvedPaymentMethodLabel,
      appBaseUrl: params.appBaseUrl,
      nativeInAppPaymentReturn: params.nativeInAppPaymentReturn,
      sessionMarketingRef: sessionMarketingRef.length > 0 ? sessionMarketingRef : verified.bookingId,
      amountCentavos: resolvedPricing.amountCentavos,
      checkoutContext,
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
      customerName: lead.name,
      customerEmail: leadEmail,
      customerCompany: typeof lead.company === 'string' && lead.company.trim().length > 0 ? lead.company.trim() : null,
      customerPhone: typeof lead.phone === 'string' ? lead.phone.trim() : '',
      bookingStatus: verified.booking.status,
      timing,
    });
  }
  timing?.mark('db_writes');
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
    diagnosticSessionIdHex: booking.diagnosticSessionId !== undefined && booking.diagnosticSessionId !== null ? booking.diagnosticSessionId.toString() : null,
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
  const providerResult = await runProviderCheckout({
    checkoutContext,
    gatewayId: params.gatewayId,
    successUrl,
    sessionInput: {
      amountCentavos: resolvedPricing.amountCentavos,
      currency: 'PHP',
      description: 'TeqMD Consultation Booking',
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
      paymentMethodId: params.paymentMethodId,
      customerName: lead.name,
      customerEmail: leadEmail,
      customerPhone: typeof lead.phone === 'string' ? lead.phone.trim() : '',
    },
    timing,
  });
  if (!providerResult.ok) {
    return providerResult;
  }
  timing?.mark('provider_persist');
  await updatePaymentTransactionProvider(insertedId, providerResult.session);
  const refreshed = await findPaymentTransactionById(transactionId);
  if (refreshed !== null) {
    if (expiresAt !== null) {
      timing?.mark('hold_renew');
      await renewBookingCheckoutHoldFromOpenTransaction({
        bookingId: booking._id,
        transaction: refreshed,
        expiresAt,
      });
    }
    void executeSendBookingPaymentReminderEmail({ transaction: refreshed });
  }
  return {
    ok: true,
    transactionId,
    redirectUrl: providerResult.session.redirectUrl,
    bookingId: verified.bookingId,
    manualConfirm: false,
    mock: providerResult.session.useMock,
    bookingStatus: verified.booking.status,
  };
}

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
    recordingOptIn: params.recordingOptIn,
    timing: params.timing,
  });
}

export async function createPaymentCheckoutForAccountBooking(params: {
  readonly bookingId: string;
  readonly visitorId: string;
  readonly gatewayId: import('@/domain/payment-types').PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
  readonly appBaseUrl: string;
  readonly nativeInAppPaymentReturn?: boolean;
  readonly promoCode?: string | null;
  readonly recordingOptIn?: boolean;
  readonly timing?: CheckoutTimingCollector;
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
    recordingOptIn: params.recordingOptIn,
    timing: params.timing,
  });
}
