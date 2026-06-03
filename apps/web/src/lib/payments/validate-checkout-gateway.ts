import { findPaymentMethodOption, type PaymentGatewayId } from '@/domain/payment-types';
import {
  isGatewayEnabledForCheckout,
  type CheckoutPaymentContext,
} from '@/lib/payments/payment-checkout-context';

export type ValidatedCheckoutGateway = {
  readonly settings: CheckoutPaymentContext['settings'];
  readonly resolvedPaymentMethodLabel: string;
};

export function validateCheckoutGatewayMethod(input: {
  readonly context: CheckoutPaymentContext;
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
  readonly paymentMethodLabel?: string;
}):
  | { readonly ok: true; readonly validated: ValidatedCheckoutGateway }
  | { readonly ok: false; readonly code: string; readonly error: string } {
  if (!input.context.settings.paymentsEnabled) {
    return { ok: false, code: 'payments_disabled', error: 'Online payments are not enabled.' };
  }
  if (!isGatewayEnabledForCheckout(input.context, input.gatewayId)) {
    return { ok: false, code: 'gateway_unavailable', error: 'This payment gateway is not available.' };
  }
  const methodOption = findPaymentMethodOption(input.gatewayId, input.paymentMethodId);
  if (methodOption === null) {
    return {
      ok: false,
      code: 'payment_method_invalid',
      error: 'This payment method is not available for the selected gateway.',
    };
  }
  return {
    ok: true,
    validated: {
      settings: input.context.settings,
      resolvedPaymentMethodLabel: input.paymentMethodLabel ?? methodOption.label,
    },
  };
}
