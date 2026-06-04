'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const XL_MEDIA_QUERY = '(min-width: 1280px)';

type AdminDashboardActivityLayoutProps = {
  readonly schedule: ReactNode;
  readonly leads: ReactNode;
  readonly bookings: ReactNode;
  readonly className?: string;
};

export function AdminDashboardActivityLayout(props: AdminDashboardActivityLayoutProps) {
  const activityColumnRef = useRef<HTMLDivElement>(null);
  const [scheduleHeightPx, setScheduleHeightPx] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const activityColumnElement = activityColumnRef.current;
    if (activityColumnElement === null) {
      return;
    }
    const mediaQueryList = window.matchMedia(XL_MEDIA_QUERY);
    const executeSyncScheduleHeight = (): void => {
      if (!mediaQueryList.matches) {
        setScheduleHeightPx(undefined);
        return;
      }
      setScheduleHeightPx(activityColumnElement.offsetHeight);
    };
    executeSyncScheduleHeight();
    const resizeObserver = new ResizeObserver(executeSyncScheduleHeight);
    resizeObserver.observe(activityColumnElement);
    mediaQueryList.addEventListener('change', executeSyncScheduleHeight);
    window.addEventListener('resize', executeSyncScheduleHeight);
    return () => {
      resizeObserver.disconnect();
      mediaQueryList.removeEventListener('change', executeSyncScheduleHeight);
      window.removeEventListener('resize', executeSyncScheduleHeight);
    };
  }, []);
  const isScheduleHeightLocked = scheduleHeightPx !== undefined;
  return (
    <div className={cn('flex flex-col gap-6 xl:flex-row xl:items-start', props.className)}>
      <div
        data-admin-tour="page-dashboard-week"
        className={cn(
          'min-h-0 xl:min-w-0 xl:flex-[7]',
          isScheduleHeightLocked && 'flex flex-col overflow-hidden',
        )}
        style={isScheduleHeightLocked ? { height: scheduleHeightPx } : undefined}
      >
        {props.schedule}
      </div>
      <div
        ref={activityColumnRef}
        data-admin-tour="page-dashboard-activity"
        className="flex shrink-0 flex-col gap-6 xl:flex-[5]"
      >
        {props.leads}
        {props.bookings}
      </div>
    </div>
  );
}
