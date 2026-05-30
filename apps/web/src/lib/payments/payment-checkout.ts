import { randomUUID } from 'node:crypto';
import { findPaymentMethodOption, type PaymentGatewayId } from '@/domain/payment-types';
import { isMarketingSlotInPublishedAvailabilityForCheckout } from '@/lib/data/booking-availability';
import { findBookingById } from '@/lib/data/bookings';
import { insertMarketingBookingLead, type MarketingBookingLeadContact } from '@/lib/data/leads';
import { getGatewayCredentials, getPaymentSettings, getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { findPaymentTransactionById, findOpenPaymentTransactionForCheckoutSlot, insertPaymentTransaction, type PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';
import { createManualConfirmBooking, createPendingBookingForHoldPolicy } from '@/lib/payments/payment-completion';
import { isOpenPaymentTransactionHoldActive } from '@/lib/marketing/payment-hold-expiry';
import { resumeOpenPaymentTransactionCheckout } from '@/lib/payments/payment-checkout-resume-open';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { createMockPaymentAdapter, resolvePaymentAdapter } from '@techmd/payments';
import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { PaymentTransactionDocument } from '@/domain/payment-types';
import { getDb } from '@/lib/mongodb';
import { countBookingsByQuizSessionId } from '@/lib/data/bookings';
import {
  diagnoseQuizSessionExistingBookingPayability,
  findVerifiedQuizSessionPendingBookingForCheckout,
} from '@/lib/data/booking-guest-manage';
import { buildPayabilityApiExtras } from '@/lib/payments/evaluate-booking-payability';
import { findQuizSessionForVisitor } from '@/lib/data/quiz-sessions';
import { createPaymentCheckoutForVerifiedBooking } from '@/lib/payments/payment-checkout-resume';
import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { buildPaymentProviderReturnUrls } from '@/lib/payments/payment-provider-return-urls';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';
import { resolveQuizSessionObjectIdHexFromMarketingRef } from '@/lib/server/quiz-session-marketing-ref-crypto';
import type { CreateCheckoutSessionParams, CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';

export type { CreateCheckoutSessionParams, CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';

async function dispatchPaymentReminderEmailAfterCheckout(input: {
  readonly transaction: PaymentTransactionRow;
}): Promise<void> {
  void executeSendBookingPaymentReminderEmail({
    transaction: input.transaction,
  });
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

async function resolveBookingStatusByBookingId(
  bookingId: ObjectId | string | null,
): Promise<'pending' | 'confirmed' | 'completed' | 'cancelled' | null> {
  if (bookingId === null) {
    return null;
  }
  const id = typeof bookingId === 'string' ? bookingId.trim() : bookingId.toString();
  if (id.length === 0) {
    return null;
  }
  const booking = await findBookingById(id);
  return booking?.status ?? null;
}

export async function createPaymentCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult> {
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
  const resolvedPaymentMethodLabel = params.paymentMethodLabel ?? methodOption.label;
  const settings = await getPaymentSettings();
  const sessionMarketingRef = params.quizSessionId.trim();
  const resolvedQuizSessionHex = resolveQuizSessionObjectIdHexFromMarketingRef(sessionMarketingRef);
  if (resolvedQuizSessionHex === null) {
    return { ok: false, code: 'quiz_session_invalid_id', error: 'Invalid quiz session reference.' };
  }
  const ownedQuizSession = await findQuizSessionForVisitor(params.visitorId, resolvedQuizSessionHex);
  if (ownedQuizSession === null) {
    return {
      ok: false,
      code: 'quiz_session_not_found',
      error: 'This diagnostic was not found or you no longer have access to it.',
    };
  }
  if (ownedQuizSession._id !== undefined) {
    const existingBookingCount = await countBookingsByQuizSessionId(ownedQuizSession._id);
    if (existingBookingCount > 0) {
      const pendingBooking = await findVerifiedQuizSessionPendingBookingForCheckout(
        params.visitorId,
        ownedQuizSession._id,
      );
      if (pendingBooking !== null) {
        return createPaymentCheckoutForVerifiedBooking(pendingBooking, {
          gatewayId: params.gatewayId,
          paymentMethodId: params.paymentMethodId,
          paymentMethodLabel: params.paymentMethodLabel,
          appBaseUrl: params.appBaseUrl,
          nativeInAppPaymentReturn: params.nativeInAppPaymentReturn,
          promoCode: params.promoCode,
          recordingOptIn: params.recordingOptIn,
          sessionMarketingRef,
        });
      }
      const diagnosis = await diagnoseQuizSessionExistingBookingPayability(params.visitorId, ownedQuizSession._id);
      if (diagnosis !== null && !diagnosis.canPayOnline) {
        return {
          ok: false,
          code: 'booking_not_payable',
          error: diagnosis.reason ?? 'This booking cannot be paid online.',
          ...buildPayabilityApiExtras(diagnosis),
        };
      }
      return {
        ok: false,
        code: 'quiz_session_already_booked',
        error: 'This diagnostic is already linked to a booking.',
        ...(diagnosis !== null ? buildPayabilityApiExtras(diagnosis) : {}),
      };
    }
  }
  let startsAt: Date;
  try {
    startsAt = parseBookingSlotToUtc(params.date, params.time);
  } catch {
    return { ok: false, code: 'invalid_slot', error: 'Invalid date or time.' };
  }
  const contact: MarketingBookingLeadContact = {
    name: params.customerName.trim(),
    email: params.customerEmail.trim(),
    company: params.customerCompany?.trim() ?? '',
    phone: params.customerPhone.trim(),
  };
  let resolvedPricing;
  try {
    resolvedPricing = await resolveCheckoutAmountCentavos({
      serviceKey: params.serviceKey,
      promoCode: params.promoCode,
      recordingOptIn: params.recordingOptIn === true,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'promo_invalid',
      error: error instanceof Error ? error.message : 'Invalid promo code.',
    };
  }
  const existingOpenTransaction = await findOpenPaymentTransactionForCheckoutSlot({
    visitorId: params.visitorId,
    quizSessionIdHex: resolvedQuizSessionHex,
    serviceKey: params.serviceKey,
    startsAtUtc: startsAt,
  });
  if (existingOpenTransaction !== null && isOpenPaymentTransactionHoldActive(existingOpenTransaction)) {
    return resumeOpenPaymentTransactionCheckout({
      transaction: existingOpenTransaction,
      visitorId: params.visitorId,
      gatewayId: params.gatewayId,
      paymentMethodId: params.paymentMethodId,
      paymentMethodLabel: resolvedPaymentMethodLabel,
      appBaseUrl: params.appBaseUrl,
      nativeInAppPaymentReturn: params.nativeInAppPaymentReturn,
      sessionMarketingRef,
      amountCentavos: resolvedPricing.amountCentavos,
      metadata: {
        bookingDraftId: existingOpenTransaction.bookingDraftId,
        paymentMethodId: params.paymentMethodId,
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
      customerName: contact.name,
      customerEmail: contact.email,
      customerCompany: contact.company.length > 0 ? contact.company : null,
      customerPhone: contact.phone,
      bookingStatus: null,
    });
  }
  const slotOk = await isMarketingSlotInPublishedAvailabilityForCheckout({
    serviceKey: params.serviceKey,
    startsAtUtc: startsAt,
    quizSessionIdHex: resolvedQuizSessionHex,
  });
  if (!slotOk) {
    return { ok: false, code: 'booking_slot_unavailable', error: 'This time is no longer available.' };
  }
  const leadId = await insertMarketingBookingLead(params.visitorId, contact);
  if (leadId === null) {
    return { ok: false, code: 'database_unavailable', error: 'Database unavailable.' };
  }
  const bookingDraftId = randomUUID();
  const expiresAt =
    settings.paymentPolicy === 'pay_after_hold'
      ? new Date(Date.now() + settings.holdExpiresMinutes * 60_000)
      : null;
  const insertedId = await insertPaymentTransaction({
    gatewayId: params.gatewayId,
    providerRef: bookingDraftId,
    providerSessionId: bookingDraftId,
    paymentPolicy: settings.paymentPolicy,
    amountCentavos: resolvedPricing.amountCentavos,
    visitorId: params.visitorId,
    bookingDraftId,
    serviceKey: params.serviceKey,
    startsAt,
    timezone: PRIMARY_TIMEZONE,
    leadId,
    customerName: contact.name,
    customerEmail: contact.email,
    customerCompany: contact.company,
    customerPhone: contact.phone,
    quizSessionIdHex: resolvedQuizSessionHex,
    paymentMethodLabel: resolvedPaymentMethodLabel,
    redirectUrl: null,
    metadata: {
      bookingDraftId,
      paymentMethodId: params.paymentMethodId,
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
  });
  if (insertedId === null) {
    return { ok: false, code: 'database_unavailable', error: 'Could not create payment session.' };
  }
  const transactionId = insertedId.toString();
  const row = await findPaymentTransactionById(transactionId, params.visitorId);
  if (row === null) {
    return { ok: false, code: 'database_unavailable', error: 'Could not load payment session.' };
  }
  if (settings.paymentPolicy === 'manual_confirm') {
    const bookingId = await createManualConfirmBooking({ transaction: row });
    const bookingStatus = await resolveBookingStatusByBookingId(bookingId);
    return {
      ok: true,
      transactionId,
      redirectUrl: null,
      bookingId: bookingId?.toString() ?? null,
      manualConfirm: true,
      bookingStatus,
    };
  }
  if (settings.paymentPolicy === 'pay_after_hold' && expiresAt !== null) {
    await createPendingBookingForHoldPolicy({ transaction: row, expiresAt });
  }
  const credentials = await getGatewayCredentials(params.gatewayId);
  const useMock = credentials === null && process.env.NODE_ENV === 'development';
  const { successUrl, cancelUrl } = buildPaymentProviderReturnUrls({
    appBaseUrl: params.appBaseUrl,
    transactionId,
    nativeInAppPaymentReturn: params.nativeInAppPaymentReturn === true,
    cancelRelativeUrl: `${buildMarketingBookSessionPath(sessionMarketingRef)}?payment=cancelled`,
    sessionMarketingRef,
  });
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
      amountCentavos: resolvedPricing.amountCentavos,
      currency: 'PHP',
      description: 'TechMD Consultation Booking',
      successUrl,
      cancelUrl,
      referenceId: bookingDraftId,
      metadata: {
        transactionId,
        visitorId: params.visitorId,
        bookingDraftId,
        paymentMethodId: params.paymentMethodId,
      },
      sandboxMode: settings.sandboxMode,
      paymentMethodId: params.paymentMethodId,
      customerName: contact.name,
      customerEmail: contact.email,
      customerPhone: contact.phone,
    });
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'gateway_error',
      error: error instanceof Error ? error.message : 'Payment provider error.',
    };
  }
  await updateTransactionProvider(insertedId, providerSession);
  const refreshedForReminder = await findPaymentTransactionById(transactionId, params.visitorId);
  if (refreshedForReminder !== null) {
    await dispatchPaymentReminderEmailAfterCheckout({
      transaction: refreshedForReminder,
    });
  }
  const bookingStatus = await resolveBookingStatusByBookingId(row.bookingId);
  return {
    ok: true,
    transactionId,
    redirectUrl: providerSession.redirectUrl,
    bookingId: row.bookingId,
    manualConfirm: false,
    mock: useMock,
    bookingStatus,
  };
}
