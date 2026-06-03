import { createDefaultAdvisorBookingSettingsDocument, expandAdvisorAvailabilityUtc, normalizeAdvisorBookingSettings } from '@teqmd/domain/booking-schedule';
import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isMarketingSlotInPublishedAvailabilityForCheckout } from '@/lib/data/booking-availability';

const checkoutNowUtc = new Date('2026-06-04T12:00:00.000Z');
const checkoutSettingsDoc = createDefaultAdvisorBookingSettingsDocument(checkoutNowUtc);
const checkoutSettings = normalizeAdvisorBookingSettings(checkoutSettingsDoc);
const checkoutDayKey = formatInTimeZone(new Date('2026-06-10T02:00:00.000Z'), checkoutSettings.timezone, 'yyyy-MM-dd');
const checkoutStartsAtUtc =
  expandAdvisorAvailabilityUtc({
    settings: checkoutSettings,
    fromYmd: checkoutDayKey,
    toYmd: checkoutDayKey,
    nowUtc: checkoutNowUtc,
    activeBookingStartsUtc: [],
  })[0] ?? new Date('2026-06-10T02:00:00.000Z');

vi.mock('@/lib/data/advisor-booking-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/advisor-booking-settings')>();
  return {
    ...actual,
    findAdvisorBookingSettingsDocument: vi.fn(async () => checkoutSettingsDoc),
    isCheckoutSlotInstantOccupiedExcludingSession: vi.fn(async () => false),
    listActiveBookingStartsUtcInYmdWindowForCheckout: vi.fn(async () => []),
  };
});

describe('isMarketingSlotInPublishedAvailabilityForCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses instant occupancy excluding the session and skips week load without cap overrides', async () => {
    const { isCheckoutSlotInstantOccupiedExcludingSession, listActiveBookingStartsUtcInYmdWindowForCheckout } =
      await import('@/lib/data/advisor-booking-settings');
    vi.mocked(isCheckoutSlotInstantOccupiedExcludingSession).mockResolvedValue(true);
    const startsAtUtc = checkoutStartsAtUtc;
    const available = await isMarketingSlotInPublishedAvailabilityForCheckout({
      serviceKey: 'project-rescue',
      startsAtUtc,
      diagnosticSessionIdHex: '674a1b2c3d4e5f6789012345',
    });
    expect(isCheckoutSlotInstantOccupiedExcludingSession).toHaveBeenCalledWith({
      startsAtUtc,
      excludeDiagnosticSessionIdHex: '674a1b2c3d4e5f6789012345',
    });
    expect(listActiveBookingStartsUtcInYmdWindowForCheckout).not.toHaveBeenCalled();
    expect(available).toBe(false);
  });
});
