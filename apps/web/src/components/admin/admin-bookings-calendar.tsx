'use client';

import type { EventClickArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import FullCalendar from '@fullcalendar/react';
import { addMinutes } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, type ReactElement } from 'react';
import type { BookingRow } from '@/lib/data/bookings';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type AdminBookingsCalendarProps = {
  readonly bookings: readonly BookingRow[];
};

/** Display length on the calendar grid (matches default advisor slot interval). */
const BOOKING_EVENT_MINUTES = 60;

function mapBookingToEvent(booking: BookingRow): EventInput {
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

/**
 * FullCalendar for admin bookings: month, week, day, and list views with Manila timezone.
 */
export function AdminBookingsCalendar(props: AdminBookingsCalendarProps): ReactElement {
  const router = useRouter();
  const events = useMemo(() => props.bookings.map(mapBookingToEvent), [props.bookings]);
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
    <div className="fc-admin-bookings space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Status</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
          Confirmed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm border border-[var(--booking-pending-border)] bg-[var(--booking-pending-bg)]"
            aria-hidden
          />
          Pending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted-foreground/50" aria-hidden />
          Cancelled
        </span>
        <span className="text-muted-foreground/80">Click an event to open booking details.</span>
      </div>
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
