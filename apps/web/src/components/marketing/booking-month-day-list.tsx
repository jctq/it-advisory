'use client';

import { parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { ChevronRight } from 'lucide-react';
import { useMemo, type ReactElement } from 'react';

import {
  formatSlotsLeftLabel,
  resolveSlotCountForManilaYmd,
} from '@/lib/marketing/booking-month-availability';
import { resolveManilaMonthDayYmds } from '@/lib/marketing/manila-calendar-grid-bounds';
import { cn } from '@/lib/utils';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

import type { BookingMonthFullCalendarProps } from '@/components/marketing/booking-month-calendar-props';

function manilaNoonDate(manilaYmd: string): Date {
  return fromZonedTime(parse(`${manilaYmd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), PRIMARY_TIMEZONE);
}

function formatDayListMonthDayLabel(manilaYmd: string): string {
  return formatInTimeZone(manilaNoonDate(manilaYmd), PRIMARY_TIMEZONE, 'MMMM d');
}

function formatDayListWeekdayLabel(manilaYmd: string): string {
  return formatInTimeZone(manilaNoonDate(manilaYmd), PRIMARY_TIMEZONE, 'EEEE');
}

function resolveDayOfMonth(manilaYmd: string): string {
  return formatInTimeZone(manilaNoonDate(manilaYmd), PRIMARY_TIMEZONE, 'd');
}

/**
 * Vertical day list for marketing booking on narrow viewports; one row per day in the visible month.
 */
export function BookingMonthDayList(props: BookingMonthFullCalendarProps): ReactElement {
  const monthDayYmds = useMemo(
    () => resolveManilaMonthDayYmds(props.visibleManilaYearMonth),
    [props.visibleManilaYearMonth],
  );
  const visibleDayYmds = useMemo(() => {
    if (!props.availabilityReady) {
      return monthDayYmds;
    }
    return monthDayYmds.filter((manilaYmd) => {
      const slotCount = resolveSlotCountForManilaYmd(props.availabilityByDate, manilaYmd);
      const isHighlighted =
        manilaYmd === props.selectedManilaYmd || manilaYmd === props.pendingManilaYmd;
      return slotCount > 0 || isHighlighted;
    });
  }, [
    monthDayYmds,
    props.availabilityByDate,
    props.availabilityReady,
    props.pendingManilaYmd,
    props.selectedManilaYmd,
  ]);
  const todayYmd = formatInTimeZone(new Date(), PRIMARY_TIMEZONE, 'yyyy-MM-dd');
  if (props.availabilityReady && visibleDayYmds.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        We&apos;re fully booked this month. Try another month.
      </p>
    );
  }
  return (
    <ul className="booking-month-day-list space-y-1.5" aria-label="Available days this month">
      {visibleDayYmds.map((manilaYmd) => {
        const slotCount = resolveSlotCountForManilaYmd(props.availabilityByDate, manilaYmd);
        const hasSlots = props.availabilityReady && slotCount > 0;
        const isUnavailable = props.availabilityReady && slotCount === 0;
        const isConfirmed = props.selectedManilaYmd !== null && manilaYmd === props.selectedManilaYmd;
        const isPending =
          !isConfirmed &&
          props.pendingManilaYmd !== null &&
          manilaYmd === props.pendingManilaYmd;
        const isToday = manilaYmd === todayYmd;
        const slotsLeftLabel = formatSlotsLeftLabel(slotCount);
        const monthDayLabel = formatDayListMonthDayLabel(manilaYmd);
        const weekdayLabel = formatDayListWeekdayLabel(manilaYmd);
        if (hasSlots) {
          return (
            <li key={manilaYmd}>
              <button
                type="button"
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  isConfirmed &&
                    'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_var(--primary)]',
                  isPending &&
                    'border-primary/40 bg-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_38%,transparent)]',
                  !isConfirmed &&
                    !isPending &&
                    'border-border hover:border-primary/40 hover:bg-muted/50',
                )}
                aria-label={`${monthDayLabel}, ${weekdayLabel}, ${slotsLeftLabel}`}
                onClick={() => {
                  props.onSelectDateWithSlots(manilaYmd);
                }}
              >
                <DayListDateBadge
                  dayOfMonth={resolveDayOfMonth(manilaYmd)}
                  isConfirmed={isConfirmed}
                  isPending={isPending}
                  isToday={isToday}
                />
                <DayListTextStack
                  monthDayLabel={monthDayLabel}
                  weekdayLabel={weekdayLabel}
                  isConfirmed={isConfirmed}
                  isToday={isToday}
                />
                <span className="shrink-0 text-xs font-semibold text-primary">{slotsLeftLabel}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        }
        return (
          <li key={manilaYmd}>
            <div
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5',
                isUnavailable && 'opacity-35',
                isConfirmed &&
                  'border-primary bg-primary/10 opacity-100 shadow-[inset_0_0_0_1px_var(--primary)]',
                isPending &&
                  'border-primary/40 bg-muted opacity-100 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_38%,transparent)]',
              )}
              aria-disabled={isUnavailable}
            >
              <DayListDateBadge
                dayOfMonth={resolveDayOfMonth(manilaYmd)}
                isConfirmed={isConfirmed}
                isPending={isPending}
                isToday={isToday}
              />
              <DayListTextStack
                monthDayLabel={formatDayListMonthDayLabel(manilaYmd)}
                weekdayLabel={formatDayListWeekdayLabel(manilaYmd)}
                isConfirmed={isConfirmed}
                isToday={isToday}
                isUnavailable={isUnavailable}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type DayListTextStackProps = {
  readonly monthDayLabel: string;
  readonly weekdayLabel: string;
  readonly isConfirmed: boolean;
  readonly isToday: boolean;
  readonly isUnavailable?: boolean;
};

function DayListTextStack(props: DayListTextStackProps): ReactElement {
  return (
    <span className="min-w-0 flex-1">
      <span
        className={cn(
          'block truncate text-sm font-medium text-foreground',
          props.isConfirmed && 'text-primary',
        )}
      >
        {props.monthDayLabel}
      </span>
      <span
        className={cn(
          'mt-0.5 block truncate text-xs text-muted-foreground',
          props.isConfirmed && 'text-primary/80',
        )}
      >
        {props.weekdayLabel}
      </span>
      {props.isToday ? (
        <span className="mt-0.5 block text-xs font-medium text-primary">Today</span>
      ) : null}
      {props.isUnavailable ? (
        <span className="mt-0.5 block text-xs text-muted-foreground">No open times</span>
      ) : null}
    </span>
  );
}

type DayListDateBadgeProps = {
  readonly dayOfMonth: string;
  readonly isConfirmed: boolean;
  readonly isPending: boolean;
  readonly isToday: boolean;
};

function DayListDateBadge(props: DayListDateBadgeProps): ReactElement {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums',
        props.isConfirmed && 'bg-primary text-primary-foreground',
        props.isPending && 'bg-muted-foreground/15 text-foreground',
        !props.isConfirmed &&
          !props.isPending &&
          props.isToday &&
          'bg-primary/15 text-primary',
        !props.isConfirmed && !props.isPending && !props.isToday && 'bg-muted text-foreground',
      )}
      aria-hidden
    >
      {props.dayOfMonth}
    </span>
  );
}
