'use client';

import type { ReactElement } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { EventInput } from '@fullcalendar/core';
import type { FullCalendarBusinessHourSegment } from '@it-advisory/domain/booking-schedule';

export type AdvisorScheduleCalendarInnerProps = {
  readonly businessHours: readonly FullCalendarBusinessHourSegment[];
  readonly timeZone: string;
};

/** Fixed template Monday (week view) for a stable preview grid. */
const ADVISOR_SCHEDULE_PREVIEW_ANCHOR = '2026-06-08';

/**
 * Read-only week-grid preview for admin schedule settings (single view, compact toolbar).
 */
export function AdvisorScheduleCalendarInner(props: AdvisorScheduleCalendarInnerProps): ReactElement {
  const bh: EventInput['businessHours'] = props.businessHours.map((s) => ({
    daysOfWeek: [...s.daysOfWeek],
    startTime: s.startTime,
    endTime: s.endTime,
  }));
  return (
    <div className="fc-advisor-preview overflow-hidden rounded-lg border border-border bg-background text-foreground">
      <FullCalendar
        plugins={[timeGridPlugin]}
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
        timeZone={props.timeZone}
        businessHours={bh}
        editable={false}
        selectable={false}
        nowIndicator
        initialDate={ADVISOR_SCHEDULE_PREVIEW_ANCHOR}
      />
    </div>
  );
}
