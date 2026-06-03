import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isMarketingSlotInPublishedAvailabilityForCheckout } from '@/lib/data/booking-availability';

vi.mock('@/lib/data/advisor-booking-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/advisor-booking-settings')>();
  return {
    ...actual,
    findAdvisorBookingSettingsDocument: vi.fn(async () => null),
    listActiveBookingStartsUtcInYmdWindowForCheckout: vi.fn(async () => [new Date('2026-06-01T02:00:00.000Z')]),
  };
});

describe('isMarketingSlotInPublishedAvailabilityForCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes diagnostic session id when loading occupancy for checkout retry', async () => {
    const { listActiveBookingStartsUtcInYmdWindowForCheckout } = await import(
      '@/lib/data/advisor-booking-settings'
    );
    const startsAtUtc = new Date('2026-06-01T02:00:00.000Z');
    const available = await isMarketingSlotInPublishedAvailabilityForCheckout({
      serviceKey: 'project-rescue',
      startsAtUtc,
      diagnosticSessionIdHex: '674a1b2c3d4e5f6789012345',
    });
    expect(listActiveBookingStartsUtcInYmdWindowForCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeDiagnosticSessionIdHex: '674a1b2c3d4e5f6789012345',
        bufferDays: 0,
      }),
    );
    expect(available).toBe(false);
  });
});
