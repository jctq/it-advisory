import { NextResponse } from 'next/server';
import { getPaymentSettingsPublicView } from '@/lib/data/payment-settings';

export async function GET(): Promise<NextResponse> {
  try {
    const config = await getPaymentSettingsPublicView();
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load payment config.', details: message }, { status: 500 });
  }
}
