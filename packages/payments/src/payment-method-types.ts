import type { PaymentGatewayId } from '@techmd/domain/payment-types';

export function resolvePaymongoPaymentMethodTypes(methodId: string): readonly string[] {
  switch (methodId) {
    case 'card':
      return ['card'];
    case 'gcash':
      return ['gcash'];
    case 'maya':
      return ['paymaya'];
    default:
      return [methodId];
  }
}

export function resolveHitpayPaymentMethods(methodId: string): readonly string[] {
  switch (methodId) {
    case 'card':
      return ['card'];
    case 'gcash':
      return ['gcash'];
    case 'paynow_online':
      return ['paynow_online'];
    default:
      return ['card', 'gcash', 'paynow_online'];
  }
}

/** Xendit invoices expose all enabled channels; method id is stored for CRM labels only unless API supports filter. */
export function resolveXenditPaymentMethods(methodId: string): readonly string[] | null {
  switch (methodId) {
    case 'card':
      return ['CREDIT_CARD', 'DEBIT_CARD'];
    case 'gcash':
      return ['GCASH'];
    case 'maya':
      return ['PAYMAYA'];
    case 'grabpay':
      return ['GRABPAY'];
    default:
      return null;
  }
}

export function isPaymentMethodIdValidForGateway(gatewayId: PaymentGatewayId, methodId: string): boolean {
  const catalog: Record<PaymentGatewayId, readonly { readonly id: string }[]> = {
    paymongo: [{ id: 'card' }, { id: 'gcash' }, { id: 'maya' }],
    xendit: [{ id: 'card' }, { id: 'gcash' }, { id: 'maya' }, { id: 'grabpay' }],
    hitpay: [{ id: 'card' }, { id: 'gcash' }, { id: 'paynow_online' }],
    paypal: [{ id: 'paypal' }],
  };
  return catalog[gatewayId].some((method) => method.id === methodId);
}
