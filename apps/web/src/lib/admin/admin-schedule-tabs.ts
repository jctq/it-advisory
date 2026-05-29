export type ScheduleTab = 'hours-grid' | 'weekdays' | 'dates' | 'caps' | 'preview';

export function resolveScheduleTab(value: string | undefined): ScheduleTab {
  if (value === 'weekdays' || value === 'dates' || value === 'caps' || value === 'preview') {
    return value;
  }
  return 'hours-grid';
}
