import {
  createDefaultAdvisorBookingSettingsDocument,
  expandPublicAvailabilitySlots,
  isUtcInstantBookable,
  normalizeAdvisorBookingSettings,
  type PublicAvailabilitySlot,
} from '@teqmd/domain/booking-schedule';
import { formatInTimeZone } from 'date-fns-tz';
import {
  addCalendarDaysToYmd,
  findAdvisorBookingSettingsDocument,
  isCheckoutSlotInstantOccupiedExcludingSession,
  listActiveBookingStartsUtcInYmdWindow,
  listActiveBookingStartsUtcInYmdWindowForCheckout,
} from '@/lib/data/advisor-booking-settings';
import type { NormalizedAdvisorBookingSettings } from '@teqmd/domain/booking-schedule';

const CAP_BUFFER_DAYS = 14 as const;

/**
 * Returns only bookable slots for the marketing funnel (no busy metadata).
 */
export async function getPublicBookingAvailabilitySlots(input: {
  readonly serviceKey: string;
  readonly fromYmd: string;
  readonly toYmd: string;
}): Promise<readonly PublicAvailabilitySlot[]> {
  const doc = await findAdvisorBookingSettingsDocument();
  const normalized =
    doc !== null
      ? normalizeAdvisorBookingSettings(doc)
      : normalizeAdvisorBookingSettings(createDefaultAdvisorBookingSettingsDocument(new Date()));
  const tz = normalized.timezone;
  const active = await listActiveBookingStartsUtcInYmdWindow({
    serviceKey: input.serviceKey,
    fromYmd: input.fromYmd,
    toYmd: input.toYmd,
    bufferDays: CAP_BUFFER_DAYS,
    timeZone: tz,
  });
  return expandPublicAvailabilitySlots({
    settings: normalized,
    fromYmd: input.fromYmd,
    toYmd: input.toYmd,
    nowUtc: new Date(),
    activeBookingStartsUtc: active,
  });
}

/**
 * Server-side check that a slot is still within published availability (caps, windows, taken times).
 */
export async function isMarketingSlotInPublishedAvailability(input: {
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
}): Promise<boolean> {
  const doc = await findAdvisorBookingSettingsDocument();
  const normalized =
    doc !== null
      ? normalizeAdvisorBookingSettings(doc)
      : normalizeAdvisorBookingSettings(createDefaultAdvisorBookingSettingsDocument(new Date()));
  const tz = normalized.timezone;
  const dayKey = formatInTimeZone(input.startsAtUtc, tz, 'yyyy-MM-dd');
  const active = await listActiveBookingStartsUtcInYmdWindow({
    serviceKey: input.serviceKey,
    fromYmd: dayKey,
    toYmd: dayKey,
    bufferDays: CAP_BUFFER_DAYS,
    timeZone: tz,
  });
  return isUtcInstantBookable({
    settings: normalized,
    startsAtUtc: input.startsAtUtc,
    nowUtc: new Date(),
    activeBookingStartsUtc: active,
  });
}

function hasBookingCapRestrictionsForInstant(
  settings: NormalizedAdvisorBookingSettings,
  startsAtUtc: Date,
  timeZone: string,
): boolean {
  const dayKey = formatInTimeZone(startsAtUtc, timeZone, 'yyyy-MM-dd');
  const weekKey = formatInTimeZone(startsAtUtc, timeZone, "RRRR-'W'II");
  return settings.dailyBookingCapOverrides.has(dayKey) || settings.weeklyBookingCapOverrides.has(weekKey);
}

/**
 * Checkout availability: same as {@link isMarketingSlotInPublishedAvailability} but allows a slot
 * already reserved by the current diagnostic session (retry during an active hold window).
 * Uses instant occupancy counts when no daily/weekly cap overrides apply (typical production path).
 */
export async function isMarketingSlotInPublishedAvailabilityForCheckout(input: {
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
  readonly diagnosticSessionIdHex: string;
  readonly visitorId?: string | null;
}): Promise<boolean> {
  const doc = await findAdvisorBookingSettingsDocument();
  const normalized =
    doc !== null
      ? normalizeAdvisorBookingSettings(doc)
      : normalizeAdvisorBookingSettings(createDefaultAdvisorBookingSettingsDocument(new Date()));
  const tz = normalized.timezone;
  const nowUtc = new Date();
  const inPublishedSchedule = isUtcInstantBookable({
    settings: normalized,
    startsAtUtc: input.startsAtUtc,
    nowUtc,
    activeBookingStartsUtc: [],
  });
  if (!inPublishedSchedule) {
    return false;
  }
  const instantOccupied = await isCheckoutSlotInstantOccupiedExcludingSession({
    startsAtUtc: input.startsAtUtc,
    excludeDiagnosticSessionIdHex: input.diagnosticSessionIdHex,
    excludeVisitorId: input.visitorId,
  });
  if (instantOccupied) {
    return false;
  }
  if (!hasBookingCapRestrictionsForInstant(normalized, input.startsAtUtc, tz)) {
    return true;
  }
  const dayKey = formatInTimeZone(input.startsAtUtc, tz, 'yyyy-MM-dd');
  const isoDow = Number.parseInt(formatInTimeZone(input.startsAtUtc, tz, 'i'), 10);
  const daysFromMonday = isoDow === 7 ? 6 : isoDow - 1;
  const weekFromYmd = addCalendarDaysToYmd(dayKey, -daysFromMonday, tz);
  const weekToYmd = addCalendarDaysToYmd(weekFromYmd, 6, tz);
  const active = await listActiveBookingStartsUtcInYmdWindowForCheckout({
    serviceKey: input.serviceKey,
    fromYmd: weekFromYmd,
    toYmd: weekToYmd,
    bufferDays: 0,
    timeZone: tz,
    excludeDiagnosticSessionIdHex: input.diagnosticSessionIdHex,
  });
  return isUtcInstantBookable({
    settings: normalized,
    startsAtUtc: input.startsAtUtc,
    nowUtc,
    activeBookingStartsUtc: active,
  });
}

/**
 * Checkout calendar allowlist: omits slots reserved by the current diagnostic session or visitor.
 */
export async function getCheckoutBookingAvailabilitySlots(input: {
  readonly serviceKey: string;
  readonly fromYmd: string;
  readonly toYmd: string;
  readonly diagnosticSessionIdHex: string;
  readonly visitorId?: string | null;
}): Promise<readonly PublicAvailabilitySlot[]> {
  const doc = await findAdvisorBookingSettingsDocument();
  const normalized =
    doc !== null
      ? normalizeAdvisorBookingSettings(doc)
      : normalizeAdvisorBookingSettings(createDefaultAdvisorBookingSettingsDocument(new Date()));
  const tz = normalized.timezone;
  const sessionHex = input.diagnosticSessionIdHex.trim();
  const active =
    sessionHex.length > 0
      ? await listActiveBookingStartsUtcInYmdWindowForCheckout({
          serviceKey: input.serviceKey,
          fromYmd: input.fromYmd,
          toYmd: input.toYmd,
          bufferDays: CAP_BUFFER_DAYS,
          timeZone: tz,
          excludeDiagnosticSessionIdHex: sessionHex,
        })
      : await listActiveBookingStartsUtcInYmdWindow({
          serviceKey: input.serviceKey,
          fromYmd: input.fromYmd,
          toYmd: input.toYmd,
          bufferDays: CAP_BUFFER_DAYS,
          timeZone: tz,
        });
  return expandPublicAvailabilitySlots({
    settings: normalized,
    fromYmd: input.fromYmd,
    toYmd: input.toYmd,
    nowUtc: new Date(),
    activeBookingStartsUtc: active,
  });
}
