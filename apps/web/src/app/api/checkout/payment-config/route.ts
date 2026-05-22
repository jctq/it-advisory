import { NextResponse } from 'next/server';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const serviceKey = url.searchParams.get('serviceKey')?.trim() ?? '';
    const promoCode = url.searchParams.get('promoCode')?.trim() ?? '';
    const config = await getPaymentSettingsPublicView();
    let resolved;
    try {
      resolved = await resolveCheckoutAmountCentavos({
        serviceKey,
        promoCode: promoCode.length > 0 ? promoCode : null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid promo code.';
      return NextResponse.json({ error: message, code: 'promo_invalid' }, { status: 400 });
    }
    return NextResponse.json({
      ...config,
      checkoutAmountCentavos: resolved.amountCentavos,
      checkoutAmountLabel: resolved.amountLabel,
      pricingSource: resolved.source,
      ...(resolved.appliedPromoCode !== undefined ? { appliedPromoCode: resolved.appliedPromoCode } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load payment config.', details: message }, { status: 500 });
  }
}
