import type { PaymentGatewayId } from '@it-advisory/domain/payment-types';
import { createHitpayAdapter } from './hitpay-adapter';
import { createPaymongoAdapter } from './paymongo-adapter';
import { createPaypalAdapter } from './paypal-adapter';
import type { GatewayCredentials, PaymentGatewayAdapter } from './types';
import { createXenditAdapter } from './xendit-adapter';

export function resolvePaymentAdapter(
  gatewayId: PaymentGatewayId,
  credentials: GatewayCredentials,
): PaymentGatewayAdapter {
  switch (gatewayId) {
    case 'paymongo':
      return createPaymongoAdapter(credentials);
    case 'xendit':
      return createXenditAdapter(credentials);
    case 'hitpay':
      return createHitpayAdapter(credentials);
    case 'paypal':
      return createPaypalAdapter(credentials);
    default: {
      const exhaustive: never = gatewayId;
      throw new Error(`Unsupported gateway: ${exhaustive}`);
    }
  }
}
