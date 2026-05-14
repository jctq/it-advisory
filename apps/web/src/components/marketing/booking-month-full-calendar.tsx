'use client';

import type { DateClickArg } from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { useEffect, useRef, type ReactElement } from 'react';

import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { cn } from '@/lib/utils';

export type BookingMonthFullCalendarProps = {
  readonly visibleManilaYearMonth: string;
  readonly availabilityByDate: Readonly<Record<string, readonly string[]>>;
  readonly availabilityReady: boolean;
  /** Confirmed booking day (date + time chosen). */
  readonly selectedManilaYmd: string | null;
  /** Day whose time list is open in the dialog (subtle emphasis until confirmed). */
  readonly pendingManilaYmd: string | null;
  readonly onSelectDateWithSlots: (manilaYmd: string) => void;
};

function manilaYmdForCalendarDate(date: Date): string {
  return formatInTimeZone(date, PRIMARY_TIMEZONE, 'yyyy-MM-dd');
}

function manilaInitialDate(visibleManilaYearMonth: string): Date {
  return fromZonedTime(
    parse(`${visibleManilaYearMonth}-01 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)),
    PRIMARY_TIMEZONE,
  );
}

/**
 * Month grid (FullCalendar) for marketing booking; uses {@link PRIMARY_TIMEZONE} for all cells and clicks.
 */
export function BookingMonthFullCalendar(props: BookingMonthFullCalendarProps): ReactElement {
  const calendarRef = useRef<FullCalendar>(null);
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
  return (
    <div className={cn('booking-month-fc text-foreground [&_.fc]:text-foreground')}>
      <FullCalendar
        key={`${props.selectedManilaYmd ?? 'none'}-${props.pendingManilaYmd ?? 'none'}`}
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        timeZone={PRIMARY_TIMEZONE}
        initialDate={manilaInitialDate(props.visibleManilaYearMonth)}
        headerToolbar={false}
        height="auto"
        fixedWeekCount={false}
        selectable={false}
        dayMaxEvents
        dateClick={(info: DateClickArg) => {
          const ymd = manilaYmdForCalendarDate(info.date);
          const count = props.availabilityByDate[ymd]?.length ?? 0;
          if (!props.availabilityReady || count === 0) {
            return;
          }
          props.onSelectDateWithSlots(ymd);
        }}
        dayCellClassNames={(arg) => {
          const ymd = manilaYmdForCalendarDate(arg.date);
          const count = props.availabilityByDate[ymd]?.length ?? 0;
          const noSlots = props.availabilityReady && count === 0;
          const classes: string[] = [];
          if (noSlots) {
            classes.push('opacity-35', 'pointer-events-none', 'cursor-not-allowed');
          }
          const isConfirmed = props.selectedManilaYmd !== null && ymd === props.selectedManilaYmd;
          const isPending =
            !isConfirmed &&
            props.pendingManilaYmd !== null &&
            ymd === props.pendingManilaYmd;
          if (isConfirmed) {
            classes.push(
              'relative',
              'z-[1]',
              'bg-primary/18',
              'font-semibold',
              'text-primary',
              'ring-2',
              'ring-inset',
              'ring-primary',
            );
          } else if (isPending) {
            classes.push('bg-muted/90', 'ring-1', 'ring-inset', 'ring-primary/35');
          }
          return classes;
        }}
      />
    </div>
  );
}
