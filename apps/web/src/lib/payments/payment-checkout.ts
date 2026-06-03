import { randomUUID } from 'node:crypto';
import { isMarketingSlotInPublishedAvailabilityForCheckout } from '@/lib/data/booking-availability';
import { insertMarketingBookingLead, type MarketingBookingLeadContact } from '@/lib/data/leads';
import {
  findOpenPaymentTransactionForCheckoutSlot,
  insertPaymentTransaction,
  type PaymentTransactionRow,
} from '@/lib/data/payment-transactions';
import { executeSendBookingPaymentReminderEmail } from '@/lib/email/send-booking-payment-reminder-email';
import { createManualConfirmBooking, createPendingBookingForHoldPolicy } from '@/lib/payments/payment-completion';
import { isOpenPaymentTransactionHoldActive } from '@/lib/marketing/payment-hold-expiry';
import { resumeOpenPaymentTransactionCheckout } from '@/lib/payments/payment-checkout-resume-open';
import { parseBookingSlotToUtc } from '@/lib/marketing/booking-slot';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { ObjectId } from 'mongodb';
import { countBookingsByDiagnosticSessionId } from '@/lib/data/bookings';
import { diagnoseDiagnosticSessionExistingBookingPayability } from '@/lib/data/booking-guest-manage';
import { ensureDiagnosticSessionPendingBookingReadyForCheckout } from '@/lib/booking/ensure-diagnostic-session-pending-booking-ready-for-checkout';
import { buildPayabilityApiExtras, parseBookingPayabilityCode } from '@/lib/payments/evaluate-booking-payability';
import { findDiagnosticSessionForVisitor } from '@/lib/data/diagnostic-sessions';
import { createPaymentCheckoutForVerifiedBooking } from '@/lib/payments/payment-checkout-resume';
import { buildMarketingBookSessionPath } from '@/lib/marketing/diagnostic-session-marketing-ref';
import { buildPaymentProviderReturnUrls } from '@/lib/payments/payment-provider-return-urls';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';
import { resolveDiagnosticSessionObjectIdHexFromMarketingRef } from '@/lib/server/diagnostic-session-marketing-ref-crypto';
import type { CreateCheckoutSessionParams, CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';
import { loadCheckoutPaymentContext } from '@/lib/payments/payment-checkout-context';
import { validateCheckoutGatewayMethod } from '@/lib/payments/validate-checkout-gateway';
import { runProviderCheckout } from '@/lib/payments/run-provider-checkout';
import { updatePaymentTransactionProvider } from '@/lib/payments/update-transaction-provider';

export type { CreateCheckoutSessionParams, CreateCheckoutSessionResult } from '@/lib/payments/payment-checkout-types';

function dispatchPaymentReminderEmailAfterCheckout(input: {
  readonly transaction: PaymentTransactionRow;
}): void {
  void executeSendBookingPaymentReminderEmail({
    transaction: input.transaction,
  });
}

function buildTransactionRowFromInsert(
  insertedId: ObjectId,
  params: CreateCheckoutSessionParams,
  input: {
    readonly bookingDraftId: string;
    readonly resolvedPaymentMethodLabel: string;
    readonly resolvedPricing: Awaited<ReturnType<typeof resolveCheckoutAmountCentavos>>;
    readonly leadId: ObjectId;
    readonly startsAt: Date;
    readonly resolvedDiagnosticSessionHex: string;
    readonly expiresAt: Date | null;
    readonly paymentPolicy: import('@/domain/payment-types').PaymentPolicy;
  },
): PaymentTransactionRow {
  const nowIso = new Date().toISOString();
  return {
    id: insertedId.toString(),
    gatewayId: params.gatewayId,
    providerRef: input.bookingDraftId,
    providerSessionId: input.bookingDraftId,
    status: 'pending',
    paymentPolicy: input.paymentPolicy,
    amountCentavos: input.resolvedPricing.amountCentavos,
    currency: 'PHP',
    visitorId: params.visitorId,
    bookingDraftId: input.bookingDraftId,
    serviceKey: params.serviceKey,
    timezone: PRIMARY_TIMEZONE,
    leadId: input.leadId.toString(),
    customerName: params.customerName.trim(),
    customerEmail: params.customerEmail.trim(),
    customerCompany: params.customerCompany?.trim() ?? null,
    customerPhone: params.customerPhone.trim(),
    diagnosticSessionIdHex: input.resolvedDiagnosticSessionHex,
    paymentMethodLabel: input.resolvedPaymentMethodLabel,
    redirectUrl: null,
    bookingId: null,
    metadata: {
      bookingDraftId: input.bookingDraftId,
      paymentMethodId: params.paymentMethodId,
      pricingSource: input.resolvedPricing.source,
      ...(input.resolvedPricing.appliedPromoCode !== undefined
        ? { promoCode: input.resolvedPricing.appliedPromoCode }
        : {}),
      ...(input.resolvedPricing.catalogServiceKey !== undefined
        ? { catalogServiceKey: input.resolvedPricing.catalogServiceKey }
        : {}),
      recordingOptIn: input.resolvedPricing.recordingOptIn ? 'true' : 'false',
      ...(input.resolvedPricing.recordingSurchargeCentavos > 0
        ? { recordingSurchargeCentavos: String(input.resolvedPricing.recordingSurchargeCentavos) }
        : {}),
    },
    startsAtIso: input.startsAt.toISOString(),
    expiresAtIso: input.expiresAt !== null ? input.expiresAt.toISOString() : null,
    createdAtIso: nowIso,
    paidAtIso: null,
  };
}

export async function createPaymentCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult> {
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
  const sessionMarketingRef = params.diagnosticSessionId.trim();
  const resolvedDiagnosticSessionHex =
    params.diagnosticSessionObjectIdHex?.trim() ??
    resolveDiagnosticSessionObjectIdHexFromMarketingRef(sessionMarketingRef) ??
    null;
  if (resolvedDiagnosticSessionHex === null) {
    return { ok: false, code: 'diagnostic_session_invalid_id', error: 'Invalid diagnostic session reference.' };
  }
  timing?.mark('session_load');
  const ownedDiagnosticSession = await findDiagnosticSessionForVisitor(params.visitorId, resolvedDiagnosticSessionHex);
  if (ownedDiagnosticSession === null) {
    return {
      ok: false,
      code: 'diagnostic_session_not_found',
      error: 'This diagnostic was not found or you no longer have access to it.',
    };
  }
  if (ownedDiagnosticSession._id !== undefined) {
    timing?.mark('existing_booking_check');
    const existingBookingCount = await countBookingsByDiagnosticSessionId(ownedDiagnosticSession._id);
    if (existingBookingCount > 0) {
      const pendingReady = await ensureDiagnosticSessionPendingBookingReadyForCheckout(
        params.visitorId,
        ownedDiagnosticSession._id,
        { dateYmd: params.date, timeLabel: params.time },
      );
      if (pendingReady.ok) {
        return createPaymentCheckoutForVerifiedBooking(pendingReady.verified, {
          gatewayId: params.gatewayId,
          paymentMethodId: params.paymentMethodId,
          paymentMethodLabel: params.paymentMethodLabel,
          appBaseUrl: params.appBaseUrl,
          nativeInAppPaymentReturn: params.nativeInAppPaymentReturn,
          promoCode: params.promoCode,
          recordingOptIn: params.recordingOptIn,
          sessionMarketingRef,
          timing,
        });
      }
      if (!pendingReady.ok && pendingReady.code !== 'booking_not_found') {
        const payabilityCode = parseBookingPayabilityCode(pendingReady.code);
        return {
          ok: false,
          code: 'booking_not_payable',
          error: pendingReady.message,
          ...(payabilityCode !== undefined ? { payabilityCode } : {}),
        };
      }
      const diagnosis = await diagnoseDiagnosticSessionExistingBookingPayability(params.visitorId, ownedDiagnosticSession._id);
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
        code: 'diagnostic_session_already_booked',
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
  timing?.mark('pricing_and_open_tx');
  let resolvedPricing: Awaited<ReturnType<typeof resolveCheckoutAmountCentavos>>;
  let existingOpenTransaction: PaymentTransactionRow | null;
  try {
    [resolvedPricing, existingOpenTransaction] = await Promise.all([
      resolveCheckoutAmountCentavos({
        serviceKey: params.serviceKey,
        promoCode: params.promoCode,
        recordingOptIn: params.recordingOptIn === true,
      }),
      findOpenPaymentTransactionForCheckoutSlot({
        visitorId: params.visitorId,
        diagnosticSessionIdHex: resolvedDiagnosticSessionHex,
        serviceKey: params.serviceKey,
        startsAtUtc: startsAt,
      }),
    ]);
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'promo_invalid',
      error: error instanceof Error ? error.message : 'Invalid promo code.',
    };
  }
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
      checkoutContext,
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
      timing,
    });
  }
  timing?.mark('slot_check');
  const slotOk = await isMarketingSlotInPublishedAvailabilityForCheckout({
    serviceKey: params.serviceKey,
    startsAtUtc: startsAt,
    diagnosticSessionIdHex: resolvedDiagnosticSessionHex,
  });
  if (!slotOk) {
    return { ok: false, code: 'booking_slot_unavailable', error: 'This time is no longer available.' };
  }
  timing?.mark('db_writes');
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
    diagnosticSessionIdHex: resolvedDiagnosticSessionHex,
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
  const row = buildTransactionRowFromInsert(insertedId, params, {
    bookingDraftId,
    resolvedPaymentMethodLabel,
    resolvedPricing,
    leadId,
    startsAt,
    resolvedDiagnosticSessionHex,
    expiresAt,
    paymentPolicy: settings.paymentPolicy,
  });
  if (settings.paymentPolicy === 'manual_confirm') {
    timing?.mark('manual_confirm');
    const bookingId = await createManualConfirmBooking({ transaction: row });
    return {
      ok: true,
      transactionId,
      redirectUrl: null,
      bookingId: bookingId?.toString() ?? null,
      manualConfirm: true,
      bookingStatus: null,
    };
  }
  if (settings.paymentPolicy === 'pay_after_hold' && expiresAt !== null) {
    timing?.mark('hold_booking');
    await createPendingBookingForHoldPolicy({ transaction: row, expiresAt });
  }
  const { successUrl, cancelUrl } = buildPaymentProviderReturnUrls({
    appBaseUrl: params.appBaseUrl,
    transactionId,
    nativeInAppPaymentReturn: params.nativeInAppPaymentReturn === true,
    cancelRelativeUrl: `${buildMarketingBookSessionPath(sessionMarketingRef)}?payment=cancelled`,
    sessionMarketingRef,
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
        visitorId: params.visitorId,
        bookingDraftId,
        paymentMethodId: params.paymentMethodId,
      },
      paymentMethodId: params.paymentMethodId,
      customerName: contact.name,
      customerEmail: contact.email,
      customerPhone: contact.phone,
    },
    timing,
  });
  if (!providerResult.ok) {
    return providerResult;
  }
  timing?.mark('provider_persist');
  await updatePaymentTransactionProvider(insertedId, providerResult.session);
  dispatchPaymentReminderEmailAfterCheckout({ transaction: row });
  return {
    ok: true,
    transactionId,
    redirectUrl: providerResult.session.redirectUrl,
    bookingId: row.bookingId,
    manualConfirm: false,
    mock: providerResult.session.useMock,
    bookingStatus: null,
  };
}
