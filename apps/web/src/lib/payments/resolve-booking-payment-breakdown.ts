import 'server-only';

import type { CheckoutPricingSource } from '@/domain/monetization-types';
import { clampAmountCentavos } from '@/lib/data/monetization-settings';
import { formatPaymentAmountLabel } from '@/lib/data/payment-settings';
import type { PaymentTransactionRow } from '@/lib/data/payment-transactions';
import type { BookingRow } from '@/lib/data/bookings';
import {
  resolveCheckoutAmountCentavos,
  type ResolvedCheckoutAmount,
} from '@/lib/payments/resolve-checkout-amount';
import { buildBookingPaymentBreakdownFromResolved } from '@/lib/payments/build-booking-payment-breakdown';
import type { BookingPaymentBreakdown } from '@/lib/payments/booking-payment-breakdown-types';
import { resolveCheckoutServiceTitle } from '@/lib/payments/resolve-checkout-service-title';

export type { BookingPaymentBreakdown } from '@/lib/payments/booking-payment-breakdown-types';
export { buildBookingPaymentBreakdownFromResolved } from '@/lib/payments/build-booking-payment-breakdown';

function parseMetadataPromoCode(metadata?: Record<string, string>): string | null {
  const raw = metadata?.promoCode?.trim() ?? '';
  return raw.length > 0 ? raw : null;
}

function parseMetadataPricingSource(metadata?: Record<string, string>): CheckoutPricingSource | null {
  const raw = metadata?.pricingSource?.trim();
  if (raw === 'custom_quote' || raw === 'promo' || raw === 'catalog' || raw === 'fallback') {
    return raw;
  }
  return null;
}

function parseMetadataRecordingOptIn(metadata?: Record<string, string>): boolean | null {
  const raw = metadata?.recordingOptIn?.trim();
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
}

function parseMetadataRecordingSurchargeCentavos(metadata?: Record<string, string>): number | null {
  const raw = metadata?.recordingSurchargeCentavos?.trim();
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return clampAmountCentavos(parsed);
}

async function buildHistoricalCustomQuotePricing(input: {
  readonly quotedAmountCentavos: number;
  readonly recordingOptIn: boolean;
  readonly recordingSurchargeCentavos: number;
}): Promise<ResolvedCheckoutAmount> {
  const quotedAmountCentavos = clampAmountCentavos(input.quotedAmountCentavos);
  const recordingSurchargeCentavos = input.recordingOptIn ? clampAmountCentavos(input.recordingSurchargeCentavos) : 0;
  const amountCentavos = clampAmountCentavos(quotedAmountCentavos + recordingSurchargeCentavos);
  return {
    amountCentavos,
    amountLabel: formatPaymentAmountLabel(amountCentavos),
    subtotalAmountCentavos: quotedAmountCentavos,
    subtotalAmountLabel: formatPaymentAmountLabel(quotedAmountCentavos),
    discountCentavos: 0,
    discountLabel: null,
    source: 'custom_quote',
    recordingOptIn: input.recordingOptIn,
    recordingSurchargeCentavos,
    recordingSurchargeLabel:
      recordingSurchargeCentavos > 0 ? formatPaymentAmountLabel(recordingSurchargeCentavos) : null,
  };
}

function reconcileResolvedPricingToPaidAmount(input: {
  readonly resolvedPricing: ResolvedCheckoutAmount;
  readonly paidAmountCentavos: number;
  readonly recordingOptIn: boolean;
  readonly recordingSurchargeCentavos: number;
  readonly promoCode: string | null;
}): ResolvedCheckoutAmount {
  if (input.resolvedPricing.amountCentavos === input.paidAmountCentavos) {
    return input.resolvedPricing;
  }
  const recordingSurchargeCentavos = input.recordingOptIn
    ? clampAmountCentavos(input.recordingSurchargeCentavos)
    : 0;
  const servicePortionCentavos = clampAmountCentavos(input.paidAmountCentavos - recordingSurchargeCentavos);
  const discountCentavos = Math.max(0, input.resolvedPricing.subtotalAmountCentavos - servicePortionCentavos);
  const appliedPromoCode = input.promoCode ?? input.resolvedPricing.appliedPromoCode;
  return {
    ...input.resolvedPricing,
    amountCentavos: input.paidAmountCentavos,
    amountLabel: formatPaymentAmountLabel(input.paidAmountCentavos),
    discountCentavos,
    discountLabel: discountCentavos > 0 ? formatPaymentAmountLabel(discountCentavos) : null,
    ...(appliedPromoCode !== undefined ? { appliedPromoCode } : {}),
    source: appliedPromoCode !== undefined ? 'promo' : input.resolvedPricing.source,
    recordingOptIn: input.recordingOptIn,
    recordingSurchargeCentavos,
    recordingSurchargeLabel:
      recordingSurchargeCentavos > 0 ? formatPaymentAmountLabel(recordingSurchargeCentavos) : null,
  };
}

async function resolvePaidCheckoutPricing(input: {
  readonly booking: BookingRow;
  readonly transaction: PaymentTransactionRow;
}): Promise<ResolvedCheckoutAmount> {
  const metadata = input.transaction.metadata;
  const pricingSource = parseMetadataPricingSource(metadata);
  const promoCode = parseMetadataPromoCode(metadata);
  const metadataRecordingOptIn = parseMetadataRecordingOptIn(metadata);
  const recordingOptIn = metadataRecordingOptIn ?? input.booking.recordingOptIn;
  const metadataRecordingSurcharge = parseMetadataRecordingSurchargeCentavos(metadata);
  const recordingSurchargeCentavos =
    input.booking.recordingOptInPriceCentavos ?? metadataRecordingSurcharge ?? 0;
  if (
    pricingSource === 'custom_quote' &&
    input.booking.quotedAmountCentavos !== null &&
    input.booking.quotedAmountCentavos >= 100
  ) {
    return buildHistoricalCustomQuotePricing({
      quotedAmountCentavos: input.booking.quotedAmountCentavos,
      recordingOptIn,
      recordingSurchargeCentavos,
    });
  }
  const resolvedPricing = await resolveCheckoutAmountCentavos({
    serviceKey: input.booking.serviceKey,
    bookingId: input.booking.id,
    promoCode,
    recordingOptIn,
  });
  return reconcileResolvedPricingToPaidAmount({
    resolvedPricing,
    paidAmountCentavos: input.transaction.amountCentavos,
    recordingOptIn,
    recordingSurchargeCentavos,
    promoCode,
  });
}

/**
 * Resolves itemized payment breakdown for admin booking detail (service, discount, add-ons, total).
 */
export async function resolveBookingPaymentBreakdown(input: {
  readonly booking: BookingRow;
  readonly transaction: PaymentTransactionRow | null;
  readonly totalCentavos: number | null;
}): Promise<BookingPaymentBreakdown | null> {
  if (input.totalCentavos === null || input.totalCentavos < 100) {
    return null;
  }
  const serviceTitle = await resolveCheckoutServiceTitle(input.booking.serviceKey);
  const resolvedPricing =
    input.transaction !== null
      ? await resolvePaidCheckoutPricing({ booking: input.booking, transaction: input.transaction })
      : await resolveCheckoutAmountCentavos({
          serviceKey: input.booking.serviceKey,
          bookingId: input.booking.id,
          recordingOptIn: input.booking.recordingOptIn,
        });
  return buildBookingPaymentBreakdownFromResolved({
    serviceTitle,
    resolvedPricing,
    totalCentavos: input.totalCentavos,
  });
}
