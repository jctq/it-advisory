import {
  findPaymentMethodOption,
  PAYMENT_GATEWAY_METHOD_CATALOG,
  type PaymentGatewayId,
} from '@/domain/payment-types';

export type ResumePaymentSelection = {
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodId: string;
};

export function resolvePaymentSelectionFromTransaction(input: {
  readonly gatewayId: PaymentGatewayId;
  readonly paymentMethodLabel: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}): ResumePaymentSelection | null {
  const gatewayId = input.gatewayId;
  const metadataMethodId = input.metadata?.paymentMethodId?.trim() ?? '';
  if (metadataMethodId.length > 0 && findPaymentMethodOption(gatewayId, metadataMethodId) !== null) {
    return { gatewayId, paymentMethodId: metadataMethodId };
  }
  const label = input.paymentMethodLabel?.trim() ?? '';
  if (label.length > 0) {
    const methods = PAYMENT_GATEWAY_METHOD_CATALOG[gatewayId];
    const matched = methods.find((method) => method.label === label || method.id === label);
    if (matched !== undefined) {
      return { gatewayId, paymentMethodId: matched.id };
    }
  }
  const fallbackMethodId = PAYMENT_GATEWAY_METHOD_CATALOG[gatewayId][0]?.id ?? null;
  if (fallbackMethodId === null) {
    return null;
  }
  return { gatewayId, paymentMethodId: fallbackMethodId };
}

export function parseResumePaymentSelection(value: unknown): ResumePaymentSelection | null {
  if (value === null || value === undefined || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const gatewayId = row.gatewayId;
  const paymentMethodId = typeof row.paymentMethodId === 'string' ? row.paymentMethodId.trim() : '';
  if (
    (gatewayId !== 'xendit' &&
      gatewayId !== 'paymongo' &&
      gatewayId !== 'hitpay' &&
      gatewayId !== 'paypal') ||
    paymentMethodId.length === 0
  ) {
    return null;
  }
  if (findPaymentMethodOption(gatewayId, paymentMethodId) === null) {
    return null;
  }
  return { gatewayId, paymentMethodId };
}
