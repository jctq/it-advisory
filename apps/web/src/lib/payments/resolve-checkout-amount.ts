import type { CheckoutPricingSource } from '@/domain/monetization-types';
import { findBookingById } from '@/lib/data/bookings';
import {
  clampAmountCentavos,
  findEnabledCatalogService,
  getMonetizationSettings,
  validatePromoCode,
} from '@/lib/data/monetization-settings';
import { formatPaymentAmountLabel, getPaymentSettings } from '@/lib/data/payment-settings';

export type ResolvedCheckoutAmount = {
  readonly amountCentavos: number;
  readonly amountLabel: string;
  readonly source: CheckoutPricingSource;
  readonly appliedPromoCode?: string;
  readonly catalogServiceKey?: string;
};

function isQuoteActive(quotedAmountCentavos: number | null, quoteExpiresAtIso: string | null): boolean {
  if (quotedAmountCentavos === null || !Number.isFinite(quotedAmountCentavos)) {
    return false;
  }
  if (quoteExpiresAtIso !== null) {
    const expiresAt = new Date(quoteExpiresAtIso);
    if (Number.isFinite(expiresAt.getTime()) && new Date() > expiresAt) {
      return false;
    }
  }
  return quotedAmountCentavos >= 100;
}

async function resolveCatalogOrFallbackAmount(serviceKey: string): Promise<{
  readonly amountCentavos: number;
  readonly source: 'catalog' | 'fallback';
  readonly catalogServiceKey?: string;
}> {
  const monetization = await getMonetizationSettings();
  const catalogEntry = findEnabledCatalogService(monetization, serviceKey);
  if (catalogEntry !== null) {
    return {
      amountCentavos: catalogEntry.amountCentavos,
      source: 'catalog',
      catalogServiceKey: catalogEntry.serviceKey,
    };
  }
  const paymentSettings = await getPaymentSettings();
  return {
    amountCentavos: clampAmountCentavos(paymentSettings.checkoutAmountCentavos),
    source: 'fallback',
  };
}

/**
 * Resolves checkout amount: custom quote → promo → catalog → payment settings fallback.
 */
export async function resolveCheckoutAmountCentavos(input: {
  readonly serviceKey: string;
  readonly promoCode?: string | null;
  readonly bookingId?: string | null;
}): Promise<ResolvedCheckoutAmount> {
  const serviceKey = input.serviceKey.trim();
  if (input.bookingId !== null && input.bookingId !== undefined && input.bookingId.trim().length > 0) {
    const booking = await findBookingById(input.bookingId.trim());
    if (
      booking !== null &&
      isQuoteActive(booking.quotedAmountCentavos, booking.quoteExpiresAtIso)
    ) {
      const amountCentavos = clampAmountCentavos(booking.quotedAmountCentavos!);
      return {
        amountCentavos,
        amountLabel: formatPaymentAmountLabel(amountCentavos),
        source: 'custom_quote',
      };
    }
  }
  const base = await resolveCatalogOrFallbackAmount(serviceKey);
  const promoCode = typeof input.promoCode === 'string' ? input.promoCode.trim() : '';
  if (promoCode.length > 0) {
    const monetization = await getMonetizationSettings();
    const validation = validatePromoCode(monetization, promoCode, serviceKey, base.amountCentavos);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    return {
      amountCentavos: validation.discountedAmountCentavos,
      amountLabel: formatPaymentAmountLabel(validation.discountedAmountCentavos),
      source: 'promo',
      appliedPromoCode: validation.promo.code,
      catalogServiceKey: base.catalogServiceKey,
    };
  }
  return {
    amountCentavos: base.amountCentavos,
    amountLabel: formatPaymentAmountLabel(base.amountCentavos),
    source: base.source,
    catalogServiceKey: base.catalogServiceKey,
  };
}
