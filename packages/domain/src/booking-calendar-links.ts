/**
 * Deep links and a minimal ICS payload so customers can add a booked session to common calendars.
 * Duration defaults to the upper bound of the published “60–90 minutes” window.
 */
export const BOOKING_SESSION_CALENDAR_DURATION_MINUTES = 90 as const;

export type BookingCalendarLinkBundle = {
  readonly googleCalendarUrl: string;
  readonly outlookCalendarUrl: string;
  /** `data:` URL suitable for “Apple / .ics” download links in web clients. */
  readonly icsDataUrl: string;
};

export type BuildBookingCalendarLinkBundleInput = {
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly startsAtUtc: Date;
  readonly durationMinutes: number;
  /** Keeps ICS UIDs stable when the same instant is re-generated (e.g. booking id). */
  readonly icsUidSeed: string;
};

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatUtcCompact(date: Date): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const h = pad2(date.getUTCHours());
  const min = pad2(date.getUTCMinutes());
  const s = pad2(date.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function encodeQueryParam(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string {
  const max = 73;
  if (line.length <= max) {
    return line;
  }
  const parts: string[] = [];
  let index = 0;
  while (index < line.length) {
    const chunkEnd = index === 0 ? max : max - 1;
    parts.push(index === 0 ? line.slice(index, index + chunkEnd) : ` ${line.slice(index, index + chunkEnd)}`);
    index += chunkEnd;
  }
  return parts.join('\r\n');
}

function buildIcsCalendarContent(input: BuildBookingCalendarLinkBundleInput, endUtc: Date): string {
  const dtStamp = formatUtcCompact(new Date());
  const dtStart = formatUtcCompact(input.startsAtUtc);
  const dtEnd = formatUtcCompact(endUtc);
  const uid = `${input.icsUidSeed.replace(/[^a-zA-Z0-9-]/g, '')}@techmd-booking`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeqMD//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(input.title)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(input.description)}`),
    foldIcsLine(`LOCATION:${escapeIcsText(input.location)}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

/**
 * Builds Google Calendar, Outlook on the web, and ICS data-URL links for one session block.
 */
export function buildBookingCalendarLinkBundle(input: BuildBookingCalendarLinkBundleInput): BookingCalendarLinkBundle {
  const endUtc = new Date(input.startsAtUtc.getTime() + input.durationMinutes * 60_000);
  const startCompact = formatUtcCompact(input.startsAtUtc);
  const endCompact = formatUtcCompact(endUtc);
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeQueryParam(input.title)}&dates=${startCompact}%2F${endCompact}&details=${encodeQueryParam(input.description)}&location=${encodeQueryParam(input.location)}`;
  const outlookCalendarUrl = `https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=${encodeURIComponent(input.title)}&startdt=${encodeURIComponent(input.startsAtUtc.toISOString())}&enddt=${encodeURIComponent(endUtc.toISOString())}&body=${encodeURIComponent(input.description)}&location=${encodeURIComponent(input.location)}`;
  const icsBody = buildIcsCalendarContent(input, endUtc);
  const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsBody)}`;
  return { googleCalendarUrl, outlookCalendarUrl, icsDataUrl };
}
