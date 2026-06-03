import type { PaymentGatewayId } from '@/domain/payment-types';
import { createMockPaymentAdapter, resolvePaymentAdapter, type CreateCheckoutSessionInput } from '@teqmd/payments';
import type { CheckoutPaymentContext } from '@/lib/payments/payment-checkout-context';
import type { CheckoutTimingCollector } from '@/lib/payments/checkout-timing';
import { executeGatewayCheckoutSession } from '@/lib/payments/execute-gateway-checkout-session';

export type ProviderCheckoutSession = {
  readonly providerRef: string;
  readonly providerSessionId: string;
  readonly redirectUrl: string;
  readonly useMock: boolean;
};

export async function runProviderCheckout(input: {
  readonly checkoutContext: CheckoutPaymentContext;
  readonly gatewayId: PaymentGatewayId;
  readonly successUrl: string;
  readonly sessionInput: Omit<CreateCheckoutSessionInput, 'successUrl' | 'cancelUrl' | 'sandboxMode'> & {
    readonly cancelUrl: string;
  };
  readonly timing?: CheckoutTimingCollector;
}): Promise<
  | { readonly ok: true; readonly session: ProviderCheckoutSession }
  | { readonly ok: false; readonly code: string; readonly error: string }
> {
  const { settings, credentials } = input.checkoutContext;
  const useMock = credentials === null && process.env.NODE_ENV === 'development';
  const adapter =
    useMock
      ? createMockPaymentAdapter(input.successUrl)
      : credentials !== null
        ? resolvePaymentAdapter(input.gatewayId, credentials)
        : null;
  if (adapter === null) {
    return { ok: false, code: 'gateway_not_configured', error: 'Payment gateway credentials are not configured.' };
  }
  try {
    const providerSession = await executeGatewayCheckoutSession({
      adapter,
      sessionInput: {
        ...input.sessionInput,
        successUrl: input.successUrl,
        sandboxMode: settings.sandboxMode,
      },
      timing: input.timing,
    });
    return { ok: true, session: { ...providerSession, useMock } };
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'gateway_error',
      error: error instanceof Error ? error.message : 'Payment provider error.',
    };
  }
}
