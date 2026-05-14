import { describe, expect, it } from 'vitest';
import type { AdvisorBookingSettingsDocument } from './types.js';
import {
  createDefaultAdvisorBookingSettingsDocument,
  expandAdvisorAvailabilityUtc,
  expandPublicAvailabilitySlots,
  isUtcInstantBookable,
  LEGACY_MARKETING_TIME_LABELS,
  normalizeAdvisorBookingSettings,
} from './booking-schedule.js';

const fixedNow = new Date('2025-06-10T12:00:00.000Z');

function baseDoc(overrides: Partial<AdvisorBookingSettingsDocument> = {}): AdvisorBookingSettingsDocument {
  return {
    ...createDefaultAdvisorBookingSettingsDocument(fixedNow),
    ...overrides,
  };
}

describe('expandAdvisorAvailabilityUtc', () => {
  it('legacy mode emits fixed labels for each calendar day', () => {
    const slots = expandAdvisorAvailabilityUtc({
      settings: null,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(slots.length).toBe(LEGACY_MARKETING_TIME_LABELS.length);
  });

  it('closes weekend days by default', () => {
    const doc = baseDoc();
    const settings = normalizeAdvisorBookingSettings(doc);
    const saturday = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-14',
      toYmd: '2025-06-14',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(saturday.length).toBe(0);
  });

  it('applies per-date override to close a weekday', () => {
    const doc = baseDoc({
      dateWindowOverrides: { '2025-06-11': { kind: 'closed' } },
    });
    const settings = normalizeAdvisorBookingSettings(doc);
    const wednesday = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(wednesday.length).toBe(0);
  });

  it('applies per-date override window on a weekend', () => {
    const doc = baseDoc({
      dateWindowOverrides: { '2025-06-14': { kind: 'window', start: '10:00', end: '12:00' } },
      slotIntervalMinutes: 60,
    });
    const settings = normalizeAdvisorBookingSettings(doc);
    const saturday = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-14',
      toYmd: '2025-06-14',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(saturday.length).toBe(2);
  });

  it('opens a weekday with hourly grid', () => {
    const doc = baseDoc({ slotIntervalMinutes: 60 });
    const settings = normalizeAdvisorBookingSettings(doc);
    const wednesday = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(wednesday.length).toBeGreaterThan(5);
  });

  it('hides all slots on a day when daily cap is reached', () => {
    const doc = baseDoc({
      dailyBookingCapOverrides: { '2025-06-11': 1 },
    });
    const settings = normalizeAdvisorBookingSettings(doc);
    const booked = [
      new Date('2025-06-11T01:00:00.000Z'),
    ];
    const slots = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: booked,
    });
    expect(slots.length).toBe(0);
  });

  it('removes a single taken instant', () => {
    const doc = baseDoc();
    const settings = normalizeAdvisorBookingSettings(doc);
    const all = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(all.length).toBeGreaterThan(1);
    const take = all[0]!;
    const filtered = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [take],
    });
    expect(filtered.some((d: Date) => d.getTime() === take.getTime())).toBe(false);
    expect(filtered.length).toBe(all.length - 1);
  });
});

describe('expandPublicAvailabilitySlots', () => {
  it('returns h:mm a labels compatible with marketing parser', () => {
    const slots = expandPublicAvailabilitySlots({
      settings: null,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    expect(slots[0]?.time.length).toBeGreaterThan(4);
    expect(slots[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isUtcInstantBookable', () => {
  it('returns true for an expanded slot', () => {
    const doc = baseDoc();
    const settings = normalizeAdvisorBookingSettings(doc);
    const slots = expandAdvisorAvailabilityUtc({
      settings,
      fromYmd: '2025-06-11',
      toYmd: '2025-06-11',
      nowUtc: fixedNow,
      activeBookingStartsUtc: [],
    });
    const first = slots[0]!;
    expect(
      isUtcInstantBookable({
        settings,
        startsAtUtc: first,
        nowUtc: fixedNow,
        activeBookingStartsUtc: [],
      }),
    ).toBe(true);
  });
});
