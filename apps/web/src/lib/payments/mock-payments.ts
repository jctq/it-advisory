export type MockPaymentResult = {
  status: 'mock_succeeded' | 'mock_failed';
  reference: string;
};

/**
 * Placeholder for Stripe/PayMongo/etc. Returns a fake reference for booking flows.
 */
export async function createMockPaymentIntent(amountCents: number): Promise<MockPaymentResult> {
  const reference = `mock_pi_${Date.now()}_${amountCents}`;
  return { status: 'mock_succeeded', reference };
}
