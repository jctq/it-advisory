'use client';

import { useMemo, type ReactElement } from 'react';
import {
  listAdvisorScheduleEndHmOptions,
  listAdvisorScheduleStartHmOptions,
  type AdvisorSlotIntervalMinutes,
} from '@techmd/domain/booking-schedule';
import { AdminSettingsLabel } from '@/components/admin/admin-settings-hint';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

type AdvisorScheduleWindowPickersProps = {
  readonly slotIntervalMinutes: AdvisorSlotIntervalMinutes;
  readonly start: string;
  readonly end: string;
  readonly onChange: (next: { readonly start: string; readonly end: string }) => void;
  readonly startId: string;
  readonly endId: string;
  readonly startLabel?: string;
  readonly endLabel?: string;
  readonly compact?: boolean;
  readonly className?: string;
};

export function AdvisorScheduleWindowPickers(props: AdvisorScheduleWindowPickersProps): ReactElement {
  const startOptions = useMemo(
    () =>
      listAdvisorScheduleStartHmOptions({
        slotIntervalMinutes: props.slotIntervalMinutes,
        endHm: props.end,
      }),
    [props.end, props.slotIntervalMinutes],
  );
  const endOptions = useMemo(
    () =>
      listAdvisorScheduleEndHmOptions({
        slotIntervalMinutes: props.slotIntervalMinutes,
        startHm: props.start,
      }),
    [props.slotIntervalMinutes, props.start],
  );
  const resolvedStart = startOptions.includes(props.start) ? props.start : (startOptions[0] ?? props.start);
  const resolvedEnd = endOptions.includes(props.end) ? props.end : (endOptions[endOptions.length - 1] ?? props.end);
  const selectClassName = cn(
    'font-mono text-sm',
    props.compact === true ? 'h-9 min-w-[6.5rem]' : 'h-11 min-w-[7rem]',
  );
  const executeChangeStart = (nextStart: string): void => {
    const nextEndOptions = listAdvisorScheduleEndHmOptions({
      slotIntervalMinutes: props.slotIntervalMinutes,
      startHm: nextStart,
    });
    const nextEnd = nextEndOptions.includes(props.end)
      ? props.end
      : (nextEndOptions[0] ?? props.end);
    props.onChange({ start: nextStart, end: nextEnd });
  };
  const executeChangeEnd = (nextEnd: string): void => {
    props.onChange({ start: props.start, end: nextEnd });
  };
  return (
    <div className={cn('flex flex-wrap items-center gap-2', props.className)}>
      <div className="flex min-w-0 items-center gap-2">
        {props.startLabel !== undefined ? (
          <span className="text-xs text-muted-foreground">{props.startLabel}</span>
        ) : null}
        <NativeSelect
          id={props.startId}
          className={selectClassName}
          value={resolvedStart}
          onChange={(event) => executeChangeStart(event.target.value)}
          aria-label={props.startLabel ?? 'Window start'}
        >
          {startOptions.map((hm) => (
            <option key={hm} value={hm}>
              {hm}
            </option>
          ))}
        </NativeSelect>
      </div>
      <span className="text-sm text-muted-foreground" aria-hidden>
        –
      </span>
      <div className="flex min-w-0 items-center gap-2">
        {props.endLabel !== undefined ? (
          <span className="text-xs text-muted-foreground">{props.endLabel}</span>
        ) : null}
        <NativeSelect
          id={props.endId}
          className={selectClassName}
          value={resolvedEnd}
          onChange={(event) => executeChangeEnd(event.target.value)}
          aria-label={props.endLabel ?? 'Window end'}
          disabled={endOptions.length === 0}
        >
          {endOptions.map((hm) => (
            <option key={hm} value={hm}>
              {hm}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

type AdvisorScheduleDefaultWindowPickersProps = {
  readonly slotIntervalMinutes: AdvisorSlotIntervalMinutes;
  readonly start: string;
  readonly end: string;
  readonly onChange: (next: { readonly start: string; readonly end: string }) => void;
};

export function AdvisorScheduleDefaultWindowPickers(props: AdvisorScheduleDefaultWindowPickersProps): ReactElement {
  const startOptions = useMemo(
    () =>
      listAdvisorScheduleStartHmOptions({
        slotIntervalMinutes: props.slotIntervalMinutes,
        endHm: props.end,
      }),
    [props.end, props.slotIntervalMinutes],
  );
  const endOptions = useMemo(
    () =>
      listAdvisorScheduleEndHmOptions({
        slotIntervalMinutes: props.slotIntervalMinutes,
        startHm: props.start,
      }),
    [props.slotIntervalMinutes, props.start],
  );
  const resolvedStart = startOptions.includes(props.start) ? props.start : (startOptions[0] ?? props.start);
  const resolvedEnd = endOptions.includes(props.end) ? props.end : (endOptions[endOptions.length - 1] ?? props.end);
  const executeChangeStart = (nextStart: string): void => {
    const nextEndOptions = listAdvisorScheduleEndHmOptions({
      slotIntervalMinutes: props.slotIntervalMinutes,
      startHm: nextStart,
    });
    const nextEnd = nextEndOptions.includes(props.end)
      ? props.end
      : (nextEndOptions[0] ?? props.end);
    props.onChange({ start: nextStart, end: nextEnd });
  };
  const executeChangeEnd = (nextEnd: string): void => {
    props.onChange({ start: props.start, end: nextEnd });
  };
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <AdminSettingsLabel
          htmlFor="adv-def-start"
          hint={
            <>
              Pick a start on the {props.slotIntervalMinutes}-minute grid. Must be before end with room for at least
              one slot.
            </>
          }
        >
          Start
        </AdminSettingsLabel>
        <NativeSelect
          id="adv-def-start"
          className="h-11 min-w-[7rem] font-mono text-sm"
          value={resolvedStart}
          onChange={(event) => executeChangeStart(event.target.value)}
          aria-label="Default weekday window start"
        >
          {startOptions.map((hm) => (
            <option key={hm} value={hm}>
              {hm}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <AdminSettingsLabel
          htmlFor="adv-def-end"
          hint={
            <>
              End is exclusive — the last offered slot must finish before this time. Options update when start or slot
              length changes.
            </>
          }
        >
          End
        </AdminSettingsLabel>
        <NativeSelect
          id="adv-def-end"
          className="h-11 min-w-[7rem] font-mono text-sm"
          value={resolvedEnd}
          onChange={(event) => executeChangeEnd(event.target.value)}
          aria-label="Default weekday window end"
          disabled={endOptions.length === 0}
        >
          {endOptions.map((hm) => (
            <option key={hm} value={hm}>
              {hm}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
