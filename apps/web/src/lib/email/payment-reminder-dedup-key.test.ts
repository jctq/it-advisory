import { describe, expect, it } from 'vitest';
import { buildPaymentReminderDedupKey } from './payment-reminder-dedup-key';
import type { PaymentTransactionRow } from '@/lib/data/payment-transactions';

function buildSampleTransaction(overrides: Partial<PaymentTransactionRow> = {}): PaymentTransactionRow {
  return {
    id: 'tx-one',
    gatewayId: 'paymongo',
    providerRef: 'ref',
    providerSessionId: 'session',
    status: 'pending',
    paymentPolicy: 'pay_before_booking',
    amountCentavos: 10000,
    currency: 'PHP',
    visitorId: 'visitor-1',
    bookingId: null,
    bookingDraftId: 'draft',
    serviceKey: 'strategy-session',
    timezone: 'Asia/Manila',
    leadId: 'lead-1',
    customerName: 'Alex',
    customerEmail: 'alex@example.com',
    customerCompany: null,
    customerPhone: '+639171234567',
    quizSessionIdHex: '507f1f77bcf86cd799439011',
    redirectUrl: null,
    paymentMethodLabel: 'GCash',
    startsAtIso: '2026-06-15T02:00:00.000Z',
    expiresAtIso: '2026-06-16T02:00:00.000Z',
    createdAtIso: '2026-06-14T02:00:00.000Z',
    paidAtIso: null,
    ...overrides,
  };
}

describe('buildPaymentReminderDedupKey', () => {
  it('uses booking id when a pending booking exists', () => {
    const transaction = buildSampleTransaction({ id: 'tx-one', bookingId: 'booking-abc' });
    expect(
      buildPaymentReminderDedupKey({
        bookingId: 'booking-abc',
        transaction,
      }),
    ).toBe('booking:booking-abc');
  });

  it('uses a stable checkout key when no booking exists yet', () => {
    const firstTransaction = buildSampleTransaction({ id: 'tx-one' });
    const secondTransaction = buildSampleTransaction({ id: 'tx-two' });
    const firstKey = buildPaymentReminderDedupKey({
      bookingId: null,
      transaction: firstTransaction,
    });
    const secondKey = buildPaymentReminderDedupKey({
      bookingId: null,
      transaction: secondTransaction,
    });
    expect(firstKey).toBe(secondKey);
    expect(firstKey).toContain('checkout:visitor-1:507f1f77bcf86cd799439011:strategy-session:');
  });
});
