import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PAYMENT_GATEWAY_IDS,
  PAYMENT_POLICIES,
  type PaymentGatewayId,
} from '@/domain/payment-types';
import { updatePaymentSettings, getPaymentSettingsAdminView } from '@/lib/data/payment-settings';
import { resolvePaymentAdapter } from '@techmd/payments';
import { getGatewayCredentials } from '@/lib/data/payment-settings';

const gatewayCredentialsSchema = z.record(z.string(), z.string()).nullable().optional();

const patchSchema = z.object({
  paymentsEnabled: z.boolean().optional(),
  paymentPolicy: z.enum(PAYMENT_POLICIES).optional(),
  checkoutAmountCentavos: z.number().int().min(100).max(100_000_000).optional(),
  holdExpiresMinutes: z.number().int().min(5).max(1440).optional(),
  sandboxMode: z.boolean().optional(),
  enabledGateways: z
    .object({
      paymongo: z.boolean().optional(),
      xendit: z.boolean().optional(),
      hitpay: z.boolean().optional(),
      paypal: z.boolean().optional(),
    })
    .optional(),
  gatewayCredentials: z
    .object({
      paymongo: gatewayCredentialsSchema,
      xendit: gatewayCredentialsSchema,
      hitpay: gatewayCredentialsSchema,
      paypal: gatewayCredentialsSchema,
    })
    .optional(),
  testGatewayId: z.enum(PAYMENT_GATEWAY_IDS).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getPaymentSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load payment settings.', details: message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  if (
    body.paymentsEnabled === undefined &&
    body.paymentPolicy === undefined &&
    body.checkoutAmountCentavos === undefined &&
    body.holdExpiresMinutes === undefined &&
    body.sandboxMode === undefined &&
    body.enabledGateways === undefined &&
    body.gatewayCredentials === undefined &&
    body.testGatewayId === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    if (body.testGatewayId !== undefined) {
      const credentials = await getGatewayCredentials(body.testGatewayId);
      if (credentials === null) {
        return NextResponse.json({ ok: false, message: 'Gateway credentials are not configured.' });
      }
      const adapter = resolvePaymentAdapter(body.testGatewayId, credentials);
      const test = await adapter.testConnection();
      return NextResponse.json(test);
    }
    const updated = await updatePaymentSettings({
      paymentsEnabled: body.paymentsEnabled,
      paymentPolicy: body.paymentPolicy,
      checkoutAmountCentavos: body.checkoutAmountCentavos,
      holdExpiresMinutes: body.holdExpiresMinutes,
      sandboxMode: body.sandboxMode,
      enabledGateways: body.enabledGateways,
      gatewayCredentials: body.gatewayCredentials as Partial<Record<PaymentGatewayId, Record<string, string> | null>> | undefined,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save payment settings.', details: message }, { status: 500 });
  }
}
