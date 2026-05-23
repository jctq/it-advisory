import { describe, expect, it } from 'vitest';
import { createPaymongoAdapter, parsePaymongoCheckoutSessionPayloadForTest } from './paymongo-adapter';

const reconcileInput = {
  providerSessionId: 'cs_test',
  providerRef: 'ORDER-001',
  sandboxMode: true,
};

describe('parsePaymongoCheckoutSessionPayload', () => {
  it('detects paid from payments attributes', () => {
    const result = parsePaymongoCheckoutSessionPayloadForTest(
      {
        data: {
          id: 'cs_test',
          attributes: {
            reference_number: 'ORDER-001',
            payments: [{ attributes: { status: 'paid', amount: 50000 } }],
          },
        },
      },
      reconcileInput,
    );
    expect(result?.status).toBe('paid');
    expect(result?.providerSessionId).toBe('cs_test');
    expect(result?.amountCentavos).toBe(50000);
  });

  it('detects paid from paid_at timestamp', () => {
    const result = parsePaymongoCheckoutSessionPayloadForTest(
      {
        data: {
          id: 'cs_test',
          attributes: {
            reference_number: 'ORDER-001',
            paid_at: 1779565275,
            payment_intent: { attributes: { amount: 600000 } },
          },
        },
      },
      reconcileInput,
    );
    expect(result?.status).toBe('paid');
    expect(result?.amountCentavos).toBe(600000);
  });

  it('detects paid from payment_intent succeeded', () => {
    const result = parsePaymongoCheckoutSessionPayloadForTest(
      {
        data: {
          id: 'cs_test',
          attributes: {
            reference_number: 'ORDER-001',
            payment_intent: { attributes: { status: 'succeeded', amount: 42000 } },
          },
        },
      },
      reconcileInput,
    );
    expect(result?.status).toBe('paid');
    expect(result?.amountCentavos).toBe(42000);
  });
});

describe('createPaymongoAdapter parseWebhook', () => {
  const adapter = createPaymongoAdapter({});

  it('parses PayMongo v2 webhook envelope (data.type / data.data)', () => {
    const result = adapter.parseWebhook({
      bodyText: JSON.stringify({
        data: {
          type: 'checkout_session.payment.paid',
          data: {
            id: 'cs_live_abc',
            type: 'checkout_session',
            attributes: {
              reference_number: 'ORDER-99',
              payments: [{ attributes: { status: 'paid', amount: 10000 } }],
            },
          },
        },
      }),
      headers: {},
    });
    expect(result?.status).toBe('paid');
    expect(result?.providerSessionId).toBe('cs_live_abc');
    expect(result?.providerRef).toBe('ORDER-99');
  });

  it('parses legacy PayMongo event envelope (data.attributes.type)', () => {
    const result = adapter.parseWebhook({
      bodyText: JSON.stringify({
        data: {
          id: 'evt_123',
          type: 'event',
          attributes: {
            type: 'checkout_session.payment.paid',
            data: {
              id: 'cs_legacy',
              attributes: {
                reference_number: 'ORDER-legacy',
                payments: [{ attributes: { status: 'paid' } }],
              },
            },
          },
        },
      }),
      headers: {},
    });
    expect(result?.status).toBe('paid');
    expect(result?.providerSessionId).toBe('cs_legacy');
    expect(result?.providerRef).toBe('ORDER-legacy');
  });
});
