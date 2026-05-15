import { NextResponse } from 'next/server';
import { handlePaymentGatewayWebhook } from '@/lib/payments/webhook-handler';

export async function POST(request: Request): Promise<NextResponse> {
  const bodyText = await request.text();
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const result = await handlePaymentGatewayWebhook({ gatewayId: 'paymongo', bodyText, headers });
  return NextResponse.json({ ok: result.handled }, { status: result.status });
}
