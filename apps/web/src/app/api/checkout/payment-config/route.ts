import { NextResponse } from 'next/server';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';
import { getRecordingSettingsPublicView } from '@/lib/data/recording-settings';
import { resolveCheckoutAmountCentavos } from '@/lib/payments/resolve-checkout-amount';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const serviceKey = url.searchParams.get('serviceKey')?.trim() ?? '';
    const promoCode = url.searchParams.get('promoCode')?.trim() ?? '';
    const recordingOptIn = url.searchParams.get('recordingOptIn') === 'true';
    const config = await getPaymentSettingsPublicView();
    const recordingConfig = await getRecordingSettingsPublicView();
    let resolved;
    try {
      resolved = await resolveCheckoutAmountCentavos({
        serviceKey,
        promoCode: promoCode.length > 0 ? promoCode : null,
        recordingOptIn,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid promo code.';
      return NextResponse.json({ error: message, code: 'promo_invalid' }, { status: 400 });
    }
    return NextResponse.json({
      ...config,
      ...recordingConfig,
      checkoutAmountCentavos: resolved.amountCentavos,
      checkoutAmountLabel: resolved.amountLabel,
      pricingSource: resolved.source,
      recordingOptIn: resolved.recordingOptIn,
      recordingSurchargeCentavos: resolved.recordingSurchargeCentavos,
      ...(resolved.appliedPromoCode !== undefined ? { appliedPromoCode: resolved.appliedPromoCode } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load payment config.', details: message }, { status: 500 });
  }
}
