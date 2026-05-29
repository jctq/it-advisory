'use client';

import type { DateClickArg } from '@fullcalendar/interaction';
import type { DayCellMountArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { parse } from 'date-fns';
import { momentTimezonePlugin } from '@/lib/fullcalendar-moment-timezone-plugin';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { useEffect, useRef, type ReactElement } from 'react';

import { BookingMonthDayList } from '@/components/marketing/booking-month-day-list';
import type { BookingMonthFullCalendarProps } from '@/components/marketing/booking-month-calendar-props';
import { useMobileViewport } from '@/hooks/use-mobile-viewport';
import {
  formatSlotsLeftLabel,
  resolveSlotCountForManilaYmd,
} from '@/lib/marketing/booking-month-availability';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

export type { BookingMonthFullCalendarProps } from '@/components/marketing/booking-month-calendar-props';

const AVAILABILITY_BADGE_CLASS = 'booking-month-day-availability';

function manilaYmdForCalendarDate(date: Date): string {
  return formatInTimeZone(date, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
}

function manilaInitialDate(visibleManilaYearMonth: string): Date {
  return fromZonedTime(
    parse(`${visibleManilaYearMonth}-01 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
    PRIMARY_TIMEZONE,
  );
}

function removeAvailabilityBadge(dayEl: HTMLElement): void {
  dayEl.querySelector(`.${AVAILABILITY_BADGE_CLASS}`)?.remove();
}

function mountAvailabilityBadgeForYmd(
  dayEl: HTMLElement,
  manilaYmd: string,
  props: BookingMonthFullCalendarProps,
): void {
  removeAvailabilityBadge(dayEl);
  const slotCount = resolveSlotCountForManilaYmd(props.availabilityByDate, manilaYmd);
  if (!props.availabilityReady || slotCount === 0) {
    return;
  }
  const frame = dayEl.querySelector('.fc-daygrid-day-frame');
  if (frame === null) {
    return;
  }
  const slotsLeftLabel = formatSlotsLeftLabel(slotCount);
  const badge = document.createElement('span');
  badge.className = AVAILABILITY_BADGE_CLASS;
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', slotsLeftLabel);
  badge.setAttribute('title', slotsLeftLabel);
  badge.textContent = slotsLeftLabel;
  frame.append(badge);
}

function syncAllAvailabilityBadges(
  calendarRoot: HTMLElement,
  props: BookingMonthFullCalendarProps,
): void {
  const dayElements = calendarRoot.querySelectorAll<HTMLElement>('.fc-daygrid-day');
  dayElements.forEach((dayEl) => {
    const manilaYmd = dayEl.getAttribute('data-date');
    if (manilaYmd === null) {
      removeAvailabilityBadge(dayEl);
      return;
    }
    mountAvailabilityBadgeForYmd(dayEl, manilaYmd, props);
  });
}

function BookingMonthFullCalendarGrid(props: BookingMonthFullCalendarProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api === undefined) {
      return;
    }
    const target = manilaInitialDate(props.visibleManilaYearMonth);
    const currentYm = formatInTimeZone(api.getDate(), PRIMARY_TIMEZONE, 'yyyy-MM');
    if (currentYm !== props.visibleManilaYearMonth) {
      api.gotoDate(target);
    }
  }, [props.visibleManilaYearMonth]);
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    syncAllAvailabilityBadges(root, props);
  }, [props.availabilityByDate, props.availabilityReady, props.visibleManilaYearMonth]);
  const handleDayCellDidMount = (arg: DayCellMountArg): void => {
    mountAvailabilityBadgeForYmd(
      arg.el,
      manilaYmdForCalendarDate(arg.date),
      propsRef.current,
    );
  };
  const handleDayCellWillUnmount = (arg: DayCellMountArg): void => {
    removeAvailabilityBadge(arg.el);
  };
  return (
    <div ref={rootRef} className="booking-month-fc">
      <FullCalendar
        ref={calendarRef}
        plugins={[momentTimezonePlugin, dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        timeZone={PRIMARY_TIMEZONE}
        initialDate={manilaInitialDate(props.visibleManilaYearMonth)}
        headerToolbar={false}
        height="auto"
        fixedWeekCount={false}
        selectable={false}
        dayMaxEvents
        dayHeaderFormat={{ weekday: 'short' }}
        dateClick={(info: DateClickArg) => {
          const ymd = manilaYmdForCalendarDate(info.date);
          const count = resolveSlotCountForManilaYmd(props.availabilityByDate, ymd);
          if (!props.availabilityReady || count === 0) {
            return;
          }
          props.onSelectDateWithSlots(ymd);
        }}
        dayCellDidMount={handleDayCellDidMount}
        dayCellWillUnmount={handleDayCellWillUnmount}
        dayCellClassNames={(arg) => {
          const ymd = manilaYmdForCalendarDate(arg.date);
          const count = resolveSlotCountForManilaYmd(props.availabilityByDate, ymd);
          const noSlots = props.availabilityReady && count === 0;
          const classes: string[] = [];
          if (noSlots) {
            classes.push('opacity-35', 'pointer-events-none', 'cursor-not-allowed');
          }
          if (props.availabilityReady && count > 0) {
            classes.push('booking-month-day-has-slots');
          }
          const isConfirmed = props.selectedManilaYmd !== null && ymd === props.selectedManilaYmd;
          const isPending =
            !isConfirmed &&
            props.pendingManilaYmd !== null &&
            ymd === props.pendingManilaYmd;
          if (isConfirmed) {
            classes.push('booking-month-day-selected');
          } else if (isPending) {
            classes.push('booking-month-day-pending');
          }
          return classes;
        }}
      />
    </div>
  );
}

/**
 * Month picker for marketing booking — vertical day list on mobile, FullCalendar grid from `md` up.
 */
export function BookingMonthFullCalendar(props: BookingMonthFullCalendarProps): ReactElement {
  const isMobileViewport = useMobileViewport();
  if (isMobileViewport) {
    return <BookingMonthDayList {...props} />;
  }
  return <BookingMonthFullCalendarGrid {...props} />;
}
