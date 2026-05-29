import {
  createDefaultAdvisorBookingSettingsDocument,
  expandPublicAvailabilitySlots,
  isUtcInstantBookable,
  normalizeAdvisorBookingSettings,
  type PublicAvailabilitySlot,
} from '@techmd/domain/booking-schedule';
import { formatInTimeZone } from 'date-fns-tz';
import {
  findAdvisorBookingSettingsDocument,
  listActiveBookingStartsUtcInYmdWindow,
  listActiveBookingStartsUtcInYmdWindowForCheckout,
} from '@/lib/data/advisor-booking-settings';

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

/**
 * Checkout availability: same as {@link isMarketingSlotInPublishedAvailability} but allows a slot
 * already reserved by the current quiz session (retry during an active hold window).
 */
export async function isMarketingSlotInPublishedAvailabilityForCheckout(input: {
  readonly serviceKey: string;
  readonly startsAtUtc: Date;
  readonly quizSessionIdHex: string;
}): Promise<boolean> {
  const doc = await findAdvisorBookingSettingsDocument();
  const normalized =
    doc !== null
      ? normalizeAdvisorBookingSettings(doc)
      : normalizeAdvisorBookingSettings(createDefaultAdvisorBookingSettingsDocument(new Date()));
  const tz = normalized.timezone;
  const dayKey = formatInTimeZone(input.startsAtUtc, tz, 'yyyy-MM-dd');
  const active = await listActiveBookingStartsUtcInYmdWindowForCheckout({
    serviceKey: input.serviceKey,
    fromYmd: dayKey,
    toYmd: dayKey,
    bufferDays: CAP_BUFFER_DAYS,
    timeZone: tz,
    excludeQuizSessionIdHex: input.quizSessionIdHex,
  });
  return isUtcInstantBookable({
    settings: normalized,
    startsAtUtc: input.startsAtUtc,
    nowUtc: new Date(),
    activeBookingStartsUtc: active,
  });
}
