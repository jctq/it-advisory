'use client';

import type { EventClickArg, EventHoveringArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import FullCalendar from '@fullcalendar/react';
import { addMinutes } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { AdminBookingEventPreview } from '@/components/admin/admin-booking-event-preview';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import type { AdminBookingCalendarRow } from '@/lib/data/bookings';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type AdminBookingsCalendarProps = {
  readonly bookings: readonly AdminBookingCalendarRow[];
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

function mapBookingToEvent(booking: AdminBookingCalendarRow): EventInput {
  const start = new Date(booking.startsAtIso);
  const end = addMinutes(start, BOOKING_EVENT_MINUTES);
  return {
    id: booking.id,
    title: booking.serviceKey,
    start: booking.startsAtIso,
    end: end.toISOString(),
    extendedProps: {
      status: booking.status,
      visitorId: booking.visitorId,
    },
    classNames: [`fc-booking-status-${booking.status}`],
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
  const router = useRouter();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const bookingsById = useMemo(() => {
    const map = new Map<string, AdminBookingCalendarRow>();
    for (const booking of props.bookings) {
      map.set(booking.id, booking);
    }
    return map;
  }, [props.bookings]);
  const events = useMemo(() => props.bookings.map(mapBookingToEvent), [props.bookings]);
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
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
