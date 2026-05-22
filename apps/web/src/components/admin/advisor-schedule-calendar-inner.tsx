'use client';

import type { ReactElement } from 'react';
import { useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { momentTimezonePlugin } from '@/lib/fullcalendar-moment-timezone-plugin';
import type { DatesSetArg, EventInput } from '@fullcalendar/core';
import {
  listYmdsForVisibleRange,
  type FullCalendarBusinessHourSegment,
} from '@techmd/domain/booking-schedule';

export type AdvisorScheduleCalendarInnerProps = {
  readonly businessHours: readonly FullCalendarBusinessHourSegment[];
  readonly timeZone: string;
  readonly initialAnchorYmd: string;
  readonly onVisibleWeekChange?: (sunToSatYmds: readonly string[]) => void;
};

function areYmdWeeksEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Read-only week-grid preview for admin schedule settings (single view, compact toolbar).
 */
export function AdvisorScheduleCalendarInner(props: AdvisorScheduleCalendarInnerProps): ReactElement {
  const { businessHours, timeZone, initialAnchorYmd, onVisibleWeekChange } = props;
  const lastWeekRef = useRef<readonly string[] | null>(null);
  const executeDatesSet = useCallback(
    (arg: DatesSetArg): void => {
      if (onVisibleWeekChange === undefined) {
        return;
      }
      const ymds = listYmdsForVisibleRange(arg.start, arg.end, timeZone);
      if (ymds.length !== 7) {
        return;
      }
      if (lastWeekRef.current !== null && areYmdWeeksEqual(lastWeekRef.current, ymds)) {
        return;
      }
      lastWeekRef.current = ymds;
      onVisibleWeekChange(ymds);
    },
    [onVisibleWeekChange, timeZone],
  );
  const bh: EventInput['businessHours'] = businessHours.map((s) => ({
    daysOfWeek: [...s.daysOfWeek],
    startTime: s.startTime,
    endTime: s.endTime,
  }));
  return (
    <div className="fc-advisor-preview overflow-hidden rounded-lg border border-border bg-background text-foreground">
      <FullCalendar
        plugins={[momentTimezonePlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next',
          center: 'title',
          right: 'today',
        }}
        height={480}
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        dayHeaderFormat={{ weekday: 'short', day: 'numeric', month: 'short' }}
        views={{
          timeGridWeek: {
            titleFormat: { month: 'short', day: 'numeric', year: 'numeric' },
          },
        }}
        allDaySlot={false}
        timeZone={timeZone}
        businessHours={bh}
        datesSet={executeDatesSet}
        editable={false}
        selectable={false}
        nowIndicator
        initialDate={initialAnchorYmd}
      />
    </div>
  );
}
