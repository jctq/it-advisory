import {
  PAYMENT_GATEWAY_PUBLIC_CONFIGS,
  type PaymentGatewayId,
  type PaymentSettingsDocument,
} from '@/domain/payment-types';
import { COLLECTIONS } from '@/domain/collections';
import {
  mergePaymentSettingsDocument,
  PAYMENT_SETTINGS_DOCUMENT_ID,
  type PaymentSettingsValues,
} from '@/lib/data/payment-settings';
import { getDb } from '@/lib/mongodb';
import {
  decryptPaymentCredentials,
} from '@/lib/server/payment-credentials-crypto';
import type { GatewayCredentials } from '@teqmd/payments';

export type CheckoutPaymentContext = {
  readonly settings: PaymentSettingsValues;
  readonly credentials: GatewayCredentials | null;
  readonly gatewayConfigured: boolean;
};

/**
 * Single Mongo read + decrypt only the selected gateway (checkout hot path).
 */
export async function loadCheckoutPaymentContext(gatewayId: PaymentGatewayId): Promise<CheckoutPaymentContext> {
  if (!process.env.MONGODB_URI) {
    const settings = mergePaymentSettingsDocument(null);
    return { settings, credentials: null, gatewayConfigured: false };
  }
  const db = await getDb();
  const doc = await db
    .collection<PaymentSettingsDocument>(COLLECTIONS.paymentSettings)
    .findOne({ _id: PAYMENT_SETTINGS_DOCUMENT_ID });
  const settings = mergePaymentSettingsDocument(doc);
  const blob = doc?.gatewayCredentials?.[gatewayId];
  if (blob === undefined) {
    return { settings, credentials: null, gatewayConfigured: false };
  }
  try {
    const credentials = decryptPaymentCredentials(blob);
    const configured = Object.values(credentials).some(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    return { settings, credentials, gatewayConfigured: configured };
  } catch {
    return { settings, credentials: null, gatewayConfigured: false };
  }
}

export function isGatewayEnabledForCheckout(
  context: CheckoutPaymentContext,
  gatewayId: PaymentGatewayId,
): boolean {
  const config = PAYMENT_GATEWAY_PUBLIC_CONFIGS.find((row) => row.id === gatewayId);
  if (config === undefined) {
    return false;
  }
  return (
    context.settings.paymentsEnabled &&
    context.settings.enabledGateways[gatewayId] === true &&
    context.gatewayConfigured
  );
}
