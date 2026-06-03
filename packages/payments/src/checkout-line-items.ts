import type { CheckoutSessionLineItem, CreateCheckoutSessionInput } from './types';

/**
 * Resolves line items for a checkout session, falling back to a single summary line.
 */
export function resolveCheckoutLineItems(input: CreateCheckoutSessionInput): readonly CheckoutSessionLineItem[] {
  if (input.lineItems !== undefined && input.lineItems.length > 0) {
    return input.lineItems;
  }
  return [{ name: input.description, amountCentavos: input.amountCentavos, quantity: 1 }];
}

/**
 * Sums line item amounts (amount × quantity).
 */
export function sumLineItemsCentavos(lineItems: readonly CheckoutSessionLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.amountCentavos * (item.quantity ?? 1), 0);
}

/**
 * Joins line item names into a single description for gateways that only accept text.
 */
export function formatLineItemsDescription(lineItems: readonly CheckoutSessionLineItem[]): string {
  return lineItems.map((item) => item.name).join(' · ');
}

/**
 * Ensures line items total matches the checkout amount before calling a provider.
 */
export function assertCheckoutLineItemsTotal(input: CreateCheckoutSessionInput): readonly CheckoutSessionLineItem[] {
  const lineItems = resolveCheckoutLineItems(input);
  const totalCentavos = sumLineItemsCentavos(lineItems);
  if (totalCentavos !== input.amountCentavos) {
    throw new Error(
      `Checkout line items total (${totalCentavos}) does not match payment amount (${input.amountCentavos}).`,
    );
  }
  return lineItems;
}
