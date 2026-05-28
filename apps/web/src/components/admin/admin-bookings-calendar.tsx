'use client';

import type { DatesSetArg, EventClickArg, EventHoveringArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import FullCalendar from '@fullcalendar/react';
import { addMinutes } from 'date-fns';
import { momentTimezonePlugin } from '@/lib/fullcalendar-moment-timezone-plugin';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AdminBookingEventPreview } from '@/components/admin/admin-booking-event-preview';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { resolveAdminBookingCalendarEventTitle } from '@/lib/admin/resolve-admin-booking-calendar-event-title';
import type { AdminBookingCalendarRow } from '@/lib/data/bookings';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type AdminBookingsCalendarFocusRequest = {
  readonly bookingId: string;
  readonly startsAtIso: string;
  /** Increments on each search so repeated lookups still navigate. */
  readonly token: number;
};

export type AdminBookingsCalendarNavigateRequest = {
  readonly fromYmd: string;
  readonly toYmd: string;
  readonly token: number;
};

export type AdminBookingsCalendarProps = {
  readonly bookings: readonly AdminBookingCalendarRow[];
  readonly isLoading: boolean;
  readonly initialAnchorYmd: string;
  readonly focusRequest: AdminBookingsCalendarFocusRequest | null;
  readonly navigateRequest: AdminBookingsCalendarNavigateRequest | null;
  readonly onVisibleRangeChange: (start: Date, end: Date) => void;
};

type AnchorRect = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

/** Display length on the calendar grid (matches default advisor slot interval). */
const BOOKING_EVENT_MINUTES = 60;

const HOVER_CLOSE_DELAY_MS = 180;
const HIGHLIGHT_DURATION_MS = 4000;
const MORE_POPOVER_VIEWPORT_PADDING_PX = 16;
const MORE_POPOVER_BODY_MIN_HEIGHT_PX = 120;

/** FullCalendar does not keep the "+n more" popover inside the viewport; clamp position and scroll height. */
function layoutAdminBookingsMorePopoverInViewport(): void {
  const popover = document.querySelector<HTMLElement>('.fc-admin-bookings .fc-more-popover');
  if (popover === null) {
    return;
  }
  const header = popover.querySelector<HTMLElement>('.fc-popover-header');
  const body = popover.querySelector<HTMLElement>('.fc-popover-body');
  if (body === null) {
    return;
  }
  const padding = MORE_POPOVER_VIEWPORT_PADDING_PX;
  const originRect =
    popover.offsetParent instanceof HTMLElement
      ? popover.offsetParent.getBoundingClientRect()
      : { top: 0, left: 0 };
  const headerHeight = header?.offsetHeight ?? 0;
  let popoverRect = popover.getBoundingClientRect();
  let viewportLeft = popoverRect.left;
  if (popoverRect.right > window.innerWidth - padding) {
    viewportLeft = Math.max(padding, window.innerWidth - padding - popoverRect.width);
  }
  viewportLeft = Math.max(padding, viewportLeft);
  let viewportTop = popoverRect.top;
  const executeApplyBodyMaxHeight = (): void => {
    const maxBodyHeight = Math.max(
      MORE_POPOVER_BODY_MIN_HEIGHT_PX,
      Math.floor(window.innerHeight - padding - viewportTop - headerHeight),
    );
    body.style.maxHeight = `${maxBodyHeight}px`;
    body.style.overflowY = 'auto';
  };
  executeApplyBodyMaxHeight();
  popoverRect = popover.getBoundingClientRect();
  if (popoverRect.bottom > window.innerHeight - padding) {
    viewportTop = Math.max(padding, window.innerHeight - padding - popoverRect.height);
    executeApplyBodyMaxHeight();
    popoverRect = popover.getBoundingClientRect();
    if (popoverRect.top < padding) {
      viewportTop = padding;
      executeApplyBodyMaxHeight();
    }
  }
  popover.style.top = `${viewportTop - originRect.top}px`;
  popover.style.left = `${viewportLeft - originRect.left}px`;
}

function mapBookingToEvent(
  booking: AdminBookingCalendarRow,
  highlightedBookingId: string | null,
): EventInput {
  const start = new Date(booking.startsAtIso);
  const end = addMinutes(start, BOOKING_EVENT_MINUTES);
  return {
    id: booking.id,
    title: resolveAdminBookingCalendarEventTitle(booking),
    start: booking.startsAtIso,
    end: end.toISOString(),
    extendedProps: {
      status: booking.status,
      visitorId: booking.visitorId,
    },
    classNames: [
      `fc-booking-status-${booking.status}`,
      ...(highlightedBookingId === booking.id ? ['fc-booking-highlighted'] : []),
    ],
  };
}

function readAnchorRect(element: HTMLElement): AnchorRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * FullCalendar for admin bookings: month, week, day, and list views with Manila timezone.
 */
export function AdminBookingsCalendar(props: AdminBookingsCalendarProps): ReactElement {
  const { bookings, focusRequest, navigateRequest, isLoading, initialAnchorYmd, onVisibleRangeChange } = props;
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const bookingsById = useMemo(() => {
    const map = new Map<string, AdminBookingCalendarRow>();
    for (const booking of bookings) {
      map.set(booking.id, booking);
    }
    return map;
  }, [bookings]);
  const events = useMemo(
    () => bookings.map((booking) => mapBookingToEvent(booking, highlightedBookingId)),
    [bookings, highlightedBookingId],
  );
  const executeDatesSet = useCallback(
    (arg: DatesSetArg): void => {
      onVisibleRangeChange(arg.start, arg.end);
    },
    [onVisibleRangeChange],
  );
  useEffect(() => {
    const focus = focusRequest;
    if (focus === null) {
      return;
    }
    const api = calendarRef.current?.getApi();
    if (api === undefined) {
      return;
    }
    api.gotoDate(new Date(focus.startsAtIso));
    setHighlightedBookingId(focus.bookingId);
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedBookingId(null);
      highlightTimerRef.current = null;
    }, HIGHLIGHT_DURATION_MS);
  }, [focusRequest]);
  useEffect(() => {
    const navigate = navigateRequest;
    if (navigate === null) {
      return;
    }
    const api = calendarRef.current?.getApi();
    if (api === undefined) {
      return;
    }
    api.gotoDate(navigate.fromYmd);
  }, [navigateRequest]);
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);
  useEffect(() => {
    const executeHandleMoreLinkClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('.fc-more-link') === null) {
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(layoutAdminBookingsMorePopoverInViewport);
      });
    };
    const executeHandleResize = (): void => {
      if (document.querySelector('.fc-admin-bookings .fc-more-popover') !== null) {
        layoutAdminBookingsMorePopoverInViewport();
      }
    };
    document.addEventListener('click', executeHandleMoreLinkClick);
    window.addEventListener('resize', executeHandleResize);
    return () => {
      document.removeEventListener('click', executeHandleMoreLinkClick);
      window.removeEventListener('resize', executeHandleResize);
    };
  }, []);
  const hoveredBooking =
    hoveredBookingId !== null ? (bookingsById.get(hoveredBookingId) ?? null) : null;
  const clearCloseTimer = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const scheduleClose = useCallback((): void => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setHoveredBookingId(null);
      setAnchorRect(null);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);
  const executeEventMouseEnter = useCallback(
    (arg: EventHoveringArg): void => {
      clearCloseTimer();
      const bookingId = arg.event.id;
      if (bookingId.length === 0 || !bookingsById.has(bookingId)) {
        return;
      }
      setAnchorRect(readAnchorRect(arg.el));
      setHoveredBookingId(bookingId);
    },
    [bookingsById, clearCloseTimer],
  );
  const executeEventMouseLeave = useCallback((): void => {
    scheduleClose();
  }, [scheduleClose]);
  const executePopoverMouseEnter = useCallback((): void => {
    clearCloseTimer();
  }, [clearCloseTimer]);
  const executePopoverMouseLeave = useCallback((): void => {
    scheduleClose();
  }, [scheduleClose]);
  const executeEventClick = useCallback(
    (arg: EventClickArg) => {
      const id = arg.event.id;
      if (id.length === 0) {
        return;
      }
      router.push(`/admin/bookings/${id}`);
    },
    [router],
  );
  return (
    <div className="space-y-4">
      <Popover open={hoveredBooking !== null} modal={false}>
        {anchorRect !== null ? (
          <PopoverAnchor asChild>
            <div
              className="pointer-events-none fixed z-40"
              style={{
                top: anchorRect.top,
                left: anchorRect.left,
                width: anchorRect.width,
                height: anchorRect.height,
              }}
              aria-hidden
            />
          </PopoverAnchor>
        ) : null}
        {hoveredBooking !== null ? (
          <AdminBookingEventPreview
            booking={hoveredBooking}
            onPreviewPointerEnter={executePopoverMouseEnter}
            onPreviewPointerLeave={executePopoverMouseLeave}
          />
        ) : null}
      </Popover>
      <div className="relative overflow-visible rounded-2xl border border-border bg-card shadow-xs">
        {isLoading ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-card/50 pt-8"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Loading…
            </span>
          </div>
        ) : null}
        <FullCalendar
          ref={calendarRef}
          plugins={[momentTimezonePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="timeGridDay"
          initialDate={initialAnchorYmd}
          datesSet={executeDatesSet}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'List',
          }}
          timeZone={PRIMARY_TIMEZONE}
          weekNumbers
          weekNumberFormat={{ week: 'narrow' }}
          navLinks
          nowIndicator
          height={720}
          events={events}
          eventClick={executeEventClick}
          eventMouseEnter={executeEventMouseEnter}
          eventMouseLeave={executeEventMouseLeave}
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          dayMaxEvents={4}
          moreLinkClick="popover"
          allDaySlot={false}
          views={{
            dayGridMonth: {
              fixedWeekCount: false,
            },
            timeGridWeek: {
              dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'short' },
            },
            timeGridDay: {
              dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
            },
            listWeek: {
              noEventsText: 'No bookings in this range.',
            },
          }}
        />
      </div>
    </div>
  );
}
