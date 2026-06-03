import { describe, expect, it } from 'vitest';
import { buildActiveOpenPaymentHoldFilter } from '@/lib/data/payment-transactions';

describe('buildActiveOpenPaymentHoldFilter', () => {
  it('excludes prepare-only checkouts that were never committed on Pay', () => {
    const now = new Date('2025-01-01T00:00:00.000Z');
    const filter = buildActiveOpenPaymentHoldFilter(now);
    expect(filter).toMatchObject({
      status: { $in: ['pending', 'processing'] },
      $and: expect.arrayContaining([
        {
          $or: [
            { 'metadata.checkoutCommitted': { $exists: false } },
            { 'metadata.checkoutCommitted': { $ne: 'false' } },
          ],
        },
      ]),
    });
  });
});
