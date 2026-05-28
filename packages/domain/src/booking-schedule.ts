import { addDays, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type {
  AdvisorBookingSettingsDocument,
  AdvisorDayTimeWindow,
  AdvisorWeekdayOverride,
} from './types.js';

export const ADVISOR_BOOKING_SETTINGS_ID = 'default' as const;

/** Matches legacy marketing booking before persisted advisor settings exist. */
/** How far before the next bookable instant marketing UIs may list same-day slots. */
export const MARKETING_BOOKING_LIST_WINDOW_BEFORE_NEXT_MS = 60 * 60 * 1000;

export const LEGACY_MARKETING_TIME_LABELS: readonly string[] = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '07:00 PM',
];

export type NormalizedAdvisorBookingSettings = {
  readonly timezone: string;
  readonly weekendDayIndices: ReadonlySet<number>;
  readonly defaultWeekdayWindow: AdvisorDayTimeWindow;
  readonly weekdayOverrides: ReadonlyMap<number, AdvisorWeekdayOverride>;
  /** `yyyy-MM-dd` in `timezone` — applied before weekday/weekend resolution. */
  readonly dateWindowOverrides: ReadonlyMap<string, AdvisorWeekdayOverride>;
  readonly slotIntervalMinutes: 30 | 45 | 60 | 90;
  readonly dailyBookingCapOverrides: ReadonlyMap<string, number>;
  readonly weeklyBookingCapOverrides: ReadonlyMap<string, number>;
  readonly bookingHorizonDays: number;
};

export type PublicAvailabilitySlot = {
  readonly date: string;
  /** 12-hour label, e.g. `09:00 AM` — matches marketing `parseBookingSlotToUtc`. */
  readonly time: string;
  readonly startsAtIso: string;
};

const SLOT_INTERVALS = new Set<number>([30, 45, 60, 90]);

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return fallback;
  }
  return rounded;
}

function parseHmToMinutes(hm: string): number | null {
  const trimmed = hm.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (match === null) {
    return null;
  }
  const h = Number.parseInt(match[1]!, 10);
  const m = Number.parseInt(match[2]!, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function minutesToHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function compareYmd(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function enumerateYmdInclusive(fromYmd: string, toYmd: string, timeZone: string): readonly string[] {
  if (compareYmd(fromYmd, toYmd) > 0) {
    return [];
  }
  const labels: string[] = [];
  let cursor = fromZonedTime(parse(`${fromYmd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  for (let guard = 0; guard < 500; guard += 1) {
    const label = formatInTimeZone(cursor, timeZone, 'yyyy-MM-dd');
    if (compareYmd(label, toYmd) > 0) {
      break;
    }
    if (compareYmd(label, fromYmd) >= 0) {
      labels.push(label);
    }
    if (label === toYmd) {
      break;
    }
    cursor = addDays(cursor, 1);
  }
  return labels;
}

function jsDayOfWeekFromYmd(ymd: string, timeZone: string): number {
  const noonUtc = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  const isoDow = Number.parseInt(formatInTimeZone(noonUtc, timeZone, 'i'), 10);
  if (isoDow === 7) {
    return 0;
  }
  return isoDow;
}

function isoWeekKey(utc: Date, timeZone: string): string {
  return formatInTimeZone(utc, timeZone, "RRRR-'W'II");
}

export function resolveAdvisorDayWindowForManilaYmd(
  ymd: string,
  settings: NormalizedAdvisorBookingSettings,
): AdvisorDayTimeWindow | null {
  const dateOverride = settings.dateWindowOverrides.get(ymd);
  if (dateOverride !== undefined) {
    if (dateOverride.kind === 'closed') {
      return null;
    }
    return { start: dateOverride.start, end: dateOverride.end };
  }
  const dow = jsDayOfWeekFromYmd(ymd, settings.timezone);
  const override = settings.weekdayOverrides.get(dow);
  if (override !== undefined) {
    if (override.kind === 'closed') {
      return null;
    }
    return { start: override.start, end: override.end };
  }
  if (settings.weekendDayIndices.has(dow)) {
    return null;
  }
  return settings.defaultWeekdayWindow;
}

function emitGridSlotsForDay(
  ymd: string,
  window: AdvisorDayTimeWindow,
  slotIntervalMinutes: number,
  timeZone: string,
): Date[] {
  const startMin = parseHmToMinutes(window.start);
  const endMin = parseHmToMinutes(window.end);
  if (startMin === null || endMin === null || startMin >= endMin) {
    return [];
  }
  const slots: Date[] = [];
  for (let t = startMin; t + slotIntervalMinutes <= endMin; t += slotIntervalMinutes) {
    const hm = minutesToHm(t);
    const wall = parse(`${ymd} ${hm}`, 'yyyy-MM-dd HH:mm', new Date(0));
    slots.push(fromZonedTime(wall, timeZone));
  }
  return slots;
}

function emitLegacySlotsForDay(ymd: string, timeZone: string): Date[] {
  const slots: Date[] = [];
  for (const label of LEGACY_MARKETING_TIME_LABELS) {
    const wall = parse(`${ymd} ${label.trim()}`, 'yyyy-MM-dd h:mm a', new Date(0));
    if (Number.isNaN(wall.getTime())) {
      continue;
    }
    slots.push(fromZonedTime(wall, timeZone));
  }
  return slots;
}

function buildCountsFromActiveBookings(
  activeBookingStartsUtc: readonly Date[],
  timeZone: string,
): { readonly dayCounts: Map<string, number>; readonly weekCounts: Map<string, number> } {
  const dayCounts = new Map<string, number>();
  const weekCounts = new Map<string, number>();
  for (const instant of activeBookingStartsUtc) {
    const dayKey = formatInTimeZone(instant, timeZone, 'yyyy-MM-dd');
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
    const weekKey = isoWeekKey(instant, timeZone);
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
  }
  return { dayCounts, weekCounts };
}

function filterSlotsByCapsAndTaken(
  slots: readonly Date[],
  settings: NormalizedAdvisorBookingSettings,
  takenMillis: ReadonlySet<number>,
  dayCounts: ReadonlyMap<string, number>,
  weekCounts: ReadonlyMap<string, number>,
): Date[] {
  const tz = settings.timezone;
  return slots.filter((utc) => {
    if (takenMillis.has(utc.getTime())) {
      return false;
    }
    const dayKey = formatInTimeZone(utc, tz, 'yyyy-MM-dd');
    const weekKey = isoWeekKey(utc, tz);
    const dayCap = settings.dailyBookingCapOverrides.get(dayKey);
    const weekCap = settings.weeklyBookingCapOverrides.get(weekKey);
    if (dayCap !== undefined && (dayCounts.get(dayKey) ?? 0) >= dayCap) {
      return false;
    }
    if (weekCap !== undefined && (weekCounts.get(weekKey) ?? 0) >= weekCap) {
      return false;
    }
    return true;
  });
}

function filterLegacyByCaps(
  slots: readonly Date[],
  timeZone: string,
  takenMillis: ReadonlySet<number>,
  dayCounts: ReadonlyMap<string, number>,
  weekCounts: ReadonlyMap<string, number>,
  dailyCaps: ReadonlyMap<string, number>,
  weeklyCaps: ReadonlyMap<string, number>,
): Date[] {
  return slots.filter((utc) => {
    if (takenMillis.has(utc.getTime())) {
      return false;
    }
    const dayKey = formatInTimeZone(utc, timeZone, 'yyyy-MM-dd');
    const weekKey = isoWeekKey(utc, timeZone);
    const dayCap = dailyCaps.get(dayKey);
    const weekCap = weeklyCaps.get(weekKey);
    if (dayCap !== undefined && (dayCounts.get(dayKey) ?? 0) >= dayCap) {
      return false;
    }
    if (weekCap !== undefined && (weekCounts.get(weekKey) ?? 0) >= weekCap) {
      return false;
    }
    return true;
  });
}

export type ExpandAdvisorAvailabilityParams = {
  readonly settings: NormalizedAdvisorBookingSettings | null;
  readonly fromYmd: string;
  readonly toYmd: string;
  readonly nowUtc: Date;
  readonly activeBookingStartsUtc: readonly Date[];
};

/**
 * Normalizes a persisted advisor settings row for slot expansion.
 */
function resolveWindowOrFallback(window: AdvisorDayTimeWindow | undefined): AdvisorDayTimeWindow {
  const fallback: AdvisorDayTimeWindow = { start: '08:00', end: '22:00' };
  if (window === undefined) {
    return fallback;
  }
  const s = parseHmToMinutes(window.start);
  const e = parseHmToMinutes(window.end);
  if (s === null || e === null || s >= e) {
    return fallback;
  }
  return window;
}

export function normalizeAdvisorBookingSettings(
  doc: AdvisorBookingSettingsDocument,
): NormalizedAdvisorBookingSettings {
  const weekend = doc.weekendDayIndices.length > 0 ? doc.weekendDayIndices : ([0, 6] as const);
  const overrides = new Map<number, AdvisorWeekdayOverride>();
  const raw = doc.weekdayOverrides ?? {};
  for (const key of Object.keys(raw)) {
    const dow = Number.parseInt(key, 10);
    if (dow < 0 || dow > 6 || Number.isNaN(dow)) {
      continue;
    }
    const value = raw[key];
    if (value === undefined) {
      continue;
    }
    if (value.kind === 'window') {
      const s = parseHmToMinutes(value.start);
      const e = parseHmToMinutes(value.end);
      if (s === null || e === null || s >= e) {
        continue;
      }
    }
    overrides.set(dow, value);
  }
  const dateOverrides = new Map<string, AdvisorWeekdayOverride>();
  const ymdKey = /^\d{4}-\d{2}-\d{2}$/;
  const rawDates = doc.dateWindowOverrides ?? {};
  for (const key of Object.keys(rawDates)) {
    if (!ymdKey.test(key)) {
      continue;
    }
    const value = rawDates[key];
    if (value === undefined) {
      continue;
    }
    if (value.kind === 'window') {
      const s = parseHmToMinutes(value.start);
      const e = parseHmToMinutes(value.end);
      if (s === null || e === null || s >= e) {
        continue;
      }
    }
    dateOverrides.set(key, value);
  }
  const daily = new Map<string, number>();
  const weekly = new Map<string, number>();
  const dco = doc.dailyBookingCapOverrides ?? {};
  for (const k of Object.keys(dco)) {
    const v = dco[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      daily.set(k, Math.floor(v));
    }
  }
  const wco = doc.weeklyBookingCapOverrides ?? {};
  for (const k of Object.keys(wco)) {
    const v = wco[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      weekly.set(k, Math.floor(v));
    }
  }
  const interval = SLOT_INTERVALS.has(doc.slotIntervalMinutes) ? doc.slotIntervalMinutes : 60;
  return {
    timezone: doc.timezone.trim().length > 0 ? doc.timezone : 'Asia/Manila',
    weekendDayIndices: new Set(weekend),
    defaultWeekdayWindow: resolveWindowOrFallback(doc.defaultWeekdayWindow),
    weekdayOverrides: overrides,
    dateWindowOverrides: dateOverrides,
    slotIntervalMinutes: interval,
    dailyBookingCapOverrides: daily,
    weeklyBookingCapOverrides: weekly,
    bookingHorizonDays: clampInt(doc.bookingHorizonDays, 1, 366, 60),
  };
}

/**
 * Default row for first admin save (weekends off, weekday 08:00–22:00, 60-minute grid).
 */
export function createDefaultAdvisorBookingSettingsDocument(now: Date): AdvisorBookingSettingsDocument {
  return {
    _id: ADVISOR_BOOKING_SETTINGS_ID,
    timezone: 'Asia/Manila',
    weekendDayIndices: [0, 6],
    defaultWeekdayWindow: { start: '08:00', end: '22:00' },
    weekdayOverrides: undefined,
    dateWindowOverrides: undefined,
    slotIntervalMinutes: 60,
    dailyBookingCapOverrides: undefined,
    weeklyBookingCapOverrides: undefined,
    bookingHorizonDays: 60,
    updatedAt: now,
  };
}

function manilaTodayYmd(nowUtc: Date, timeZone: string): string {
  return formatInTimeZone(nowUtc, timeZone, 'yyyy-MM-dd');
}

function addDaysToYmd(ymd: string, days: number, timeZone: string): string {
  const base = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  return formatInTimeZone(addDays(base, days), timeZone, 'yyyy-MM-dd');
}

/**
 * Drops instants at or before `nowUtc`, then keeps slots from one hour before the earliest future slot onward.
 */
function filterSlotsByServerTimeAndNextSlotListWindow(slots: readonly Date[], nowUtc: Date): Date[] {
  const nowMs = nowUtc.getTime();
  const futureSlots = slots.filter((slot) => slot.getTime() > nowMs);
  if (futureSlots.length === 0) {
    return [];
  }
  const listFromMs = futureSlots[0]!.getTime() - MARKETING_BOOKING_LIST_WINDOW_BEFORE_NEXT_MS;
  return slots.filter((slot) => {
    const slotMs = slot.getTime();
    return slotMs > nowMs && slotMs >= listFromMs;
  });
}

function clampRangeToHorizonAndToday(
  fromYmd: string,
  toYmd: string,
  nowUtc: Date,
  horizonDays: number,
  timeZone: string,
): { readonly from: string; readonly to: string } {
  const today = manilaTodayYmd(nowUtc, timeZone);
  const horizonEnd = addDaysToYmd(today, horizonDays, timeZone);
  const from = compareYmd(fromYmd, today) < 0 ? today : fromYmd;
  const to = compareYmd(toYmd, horizonEnd) > 0 ? horizonEnd : toYmd;
  if (compareYmd(from, to) > 0) {
    return { from: today, to: today };
  }
  return { from, to };
}

/**
 * Expands bookable instants for the inclusive date range (calendar dates in the active timezone).
 * When `settings` is null, uses legacy fixed time labels and ignores weekend/cap rules (matches pre-settings UX).
 */
export function expandAdvisorAvailabilityUtc(params: ExpandAdvisorAvailabilityParams): readonly Date[] {
  const tz = params.settings?.timezone ?? 'Asia/Manila';
  const horizon = params.settings?.bookingHorizonDays ?? 60;
  const { from, to } = clampRangeToHorizonAndToday(params.fromYmd, params.toYmd, params.nowUtc, horizon, tz);
  const taken = new Set(params.activeBookingStartsUtc.map((d) => d.getTime()));
  const { dayCounts, weekCounts } = buildCountsFromActiveBookings(params.activeBookingStartsUtc, tz);
  const days = enumerateYmdInclusive(from, to, tz);
  const candidates: Date[] = [];
  if (params.settings === null) {
    for (const ymd of days) {
      candidates.push(...emitLegacySlotsForDay(ymd, tz));
    }
    candidates.sort((a, b) => a.getTime() - b.getTime());
    const emptyCaps = new Map<string, number>();
    const legacyBookable = filterLegacyByCaps(candidates, tz, taken, dayCounts, weekCounts, emptyCaps, emptyCaps);
    return filterSlotsByServerTimeAndNextSlotListWindow(legacyBookable, params.nowUtc);
  }
  const s = params.settings;
  for (const ymd of days) {
    const window = resolveAdvisorDayWindowForManilaYmd(ymd, s);
    if (window === null) {
      continue;
    }
    candidates.push(...emitGridSlotsForDay(ymd, window, s.slotIntervalMinutes, s.timezone));
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  const bookable = filterSlotsByCapsAndTaken(candidates, s, taken, dayCounts, weekCounts);
  return filterSlotsByServerTimeAndNextSlotListWindow(bookable, params.nowUtc);
}

export function expandPublicAvailabilitySlots(params: ExpandAdvisorAvailabilityParams): readonly PublicAvailabilitySlot[] {
  const tz = params.settings?.timezone ?? 'Asia/Manila';
  const instants = expandAdvisorAvailabilityUtc(params);
  return instants.map((utc) => {
    const date = formatInTimeZone(utc, tz, 'yyyy-MM-dd');
    const time = formatInTimeZone(utc, tz, 'h:mm a');
    return { date, time, startsAtIso: utc.toISOString() };
  });
}

/**
 * True when this instant is offered by {@link expandAdvisorAvailabilityUtc} for its calendar day
 * (same `fromYmd`/`toYmd` as that day, with full active booking list for caps).
 */
export function isUtcInstantBookable(params: {
  readonly settings: NormalizedAdvisorBookingSettings | null;
  readonly startsAtUtc: Date;
  readonly nowUtc: Date;
  readonly activeBookingStartsUtc: readonly Date[];
}): boolean {
  const tz = params.settings?.timezone ?? 'Asia/Manila';
  const dayKey = formatInTimeZone(params.startsAtUtc, tz, 'yyyy-MM-dd');
  const expanded = expandAdvisorAvailabilityUtc({
    settings: params.settings,
    fromYmd: dayKey,
    toYmd: dayKey,
    nowUtc: params.nowUtc,
    activeBookingStartsUtc: params.activeBookingStartsUtc,
  });
  const target = params.startsAtUtc.getTime();
  return expanded.some((d) => d.getTime() === target);
}

/**
 * True when another non-cancelled booking already occupies this instant (solo advisor).
 */
export function hasActiveBookingAtInstant(
  activeBookingStartsUtc: readonly Date[],
  startsAtUtc: Date,
): boolean {
  const t = startsAtUtc.getTime();
  return activeBookingStartsUtc.some((d) => d.getTime() === t);
}

/** Calendar `yyyy-MM-dd` for the admin week preview — today in `timeZone`. */
export function resolveAdvisorSchedulePreviewAnchorYmd(nowUtc: Date, timeZone: string): string {
  return formatInTimeZone(nowUtc, timeZone, 'yyyy-MM-dd');
}

export type FullCalendarBusinessHourSegment = {
  readonly daysOfWeek: readonly number[];
  readonly startTime: string;
  readonly endTime: string;
};

/**
 * Sun–Sat `yyyy-MM-dd` labels for the calendar week containing `ymd` in `timeZone` (dow 0 = Sunday).
 */
export function listSunToSatYmdsForWeekContaining(ymd: string, timeZone: string): readonly string[] {
  const dow = jsDayOfWeekFromYmd(ymd, timeZone);
  const anchorNoon = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  const sundayNoon = addDays(anchorNoon, -dow);
  const sundayYmd = formatInTimeZone(sundayNoon, timeZone, 'yyyy-MM-dd');
  const saturdayYmd = formatInTimeZone(addDays(sundayNoon, 6), timeZone, 'yyyy-MM-dd');
  return enumerateYmdInclusive(sundayYmd, saturdayYmd, timeZone);
}

/**
 * `yyyy-MM-dd` labels for each day in a FullCalendar visible range (`end` is exclusive).
 */
export function listYmdsForVisibleRange(
  rangeStart: Date,
  rangeEndExclusive: Date,
  timeZone: string,
): readonly string[] {
  const fromYmd = formatInTimeZone(rangeStart, timeZone, 'yyyy-MM-dd');
  const toYmd = formatInTimeZone(addDays(rangeEndExclusive, -1), timeZone, 'yyyy-MM-dd');
  return enumerateYmdInclusive(fromYmd, toYmd, timeZone);
}

/**
 * Builds FullCalendar `businessHours` for one visible week (index 0 = Sunday … 6 = Saturday).
 */
export function buildFullCalendarBusinessHourSegments(
  settings: NormalizedAdvisorBookingSettings,
  sunToSatYmds: readonly string[],
): readonly FullCalendarBusinessHourSegment[] {
  if (sunToSatYmds.length !== 7) {
    return [];
  }
  const segments: FullCalendarBusinessHourSegment[] = [];
  for (let dow = 0; dow <= 6; dow += 1) {
    const ymd = sunToSatYmds[dow]!;
    const window = resolveAdvisorDayWindowForManilaYmd(ymd, settings);
    if (window === null) {
      continue;
    }
    segments.push({ daysOfWeek: [dow], startTime: window.start, endTime: window.end });
  }
  return segments;
}
