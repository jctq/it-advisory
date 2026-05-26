'use client';

import dynamic from 'next/dynamic';
import { parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  buildFullCalendarBusinessHourSegments,
  listSunToSatYmdsForWeekContaining,
  normalizeAdvisorBookingSettings,
  resolveAdvisorSchedulePreviewAnchorYmd,
} from '@techmd/domain/booking-schedule';
import type { AdvisorBookingSettingsDocument, AdvisorWeekdayOverride } from '@/domain/types';
import {
  AdminFormStickyFooter,
  adminFormStickyFooterScrollPaddingClass,
} from '@/components/admin/admin-form-sticky-footer';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { AdminSkeleton } from '@/components/admin/admin-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { cn } from '@/lib/utils';

const BOOKING_SCHEDULE_API_URL: string = buildApiUrl('/api/admin/booking-schedule');

const DOW_LABELS: readonly string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function resolveAdvisorDailyCapKeyFromSelection(selected: Date, timeZone: string): string {
  const ymd: string = formatInTimeZone(selected, timeZone, 'yyyy-MM-dd');
  const noonUtc: Date = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  return formatInTimeZone(noonUtc, timeZone, 'yyyy-MM-dd');
}

function resolveAdvisorWeeklyCapKeyFromSelection(selected: Date, timeZone: string): string {
  const ymd: string = formatInTimeZone(selected, timeZone, 'yyyy-MM-dd');
  const noonUtc: Date = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  return formatInTimeZone(noonUtc, timeZone, "RRRR-'W'II");
}

function formatPreviewWeekYmdLabel(ymd: string, timeZone: string): string {
  const noonUtc: Date = fromZonedTime(parse(`${ymd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  return formatInTimeZone(noonUtc, timeZone, 'EEE, MMM d');
}

function formatPreviewWeekRangeLabel(sunToSatYmds: readonly string[], timeZone: string): string | null {
  if (sunToSatYmds.length !== 7) {
    return null;
  }
  const sundayYmd: string = sunToSatYmds[0]!;
  const saturdayYmd: string = sunToSatYmds[6]!;
  const sundayNoon: Date = fromZonedTime(parse(`${sundayYmd} 12:00`, 'yyyy-MM-dd HH:mm', new Date(0)), timeZone);
  const yearLabel: string = formatInTimeZone(sundayNoon, timeZone, 'yyyy');
  return `${formatPreviewWeekYmdLabel(sundayYmd, timeZone)} – ${formatPreviewWeekYmdLabel(saturdayYmd, timeZone)}, ${yearLabel}`;
}

const CalendarInner = dynamic(
  () =>
    import('@/components/admin/advisor-schedule-calendar-inner').then((m) => m.AdvisorScheduleCalendarInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] animate-pulse rounded-xl border border-border bg-muted/40" aria-hidden />
    ),
  },
);

function cloneSettings(source: AdvisorBookingSettingsDocument): AdvisorBookingSettingsDocument {
  return {
    ...source,
    timezone: PRIMARY_TIMEZONE,
    weekendDayIndices: [...source.weekendDayIndices],
    defaultWeekdayWindow: { ...source.defaultWeekdayWindow },
    weekdayOverrides:
      source.weekdayOverrides !== undefined ? { ...source.weekdayOverrides } : undefined,
    dateWindowOverrides:
      source.dateWindowOverrides !== undefined ? { ...source.dateWindowOverrides } : undefined,
    dailyBookingCapOverrides:
      source.dailyBookingCapOverrides !== undefined ? { ...source.dailyBookingCapOverrides } : undefined,
    weeklyBookingCapOverrides:
      source.weeklyBookingCapOverrides !== undefined ? { ...source.weeklyBookingCapOverrides } : undefined,
  };
}

/**
 * Stable JSON snapshot of persisted schedule fields (excludes `_id`, `updatedAt`, etc.) for dirty detection.
 */
function serializeAdvisorBookingSettingsForComparison(doc: AdvisorBookingSettingsDocument): string {
  const overrides = doc.weekdayOverrides;
  let sortedWeekdayOverrides: Record<string, AdvisorWeekdayOverride> | undefined;
  if (overrides !== undefined) {
    const keys = Object.keys(overrides).sort();
    sortedWeekdayOverrides = {};
    for (const key of keys) {
      const value = overrides[key];
      if (value !== undefined) {
        sortedWeekdayOverrides[key] = value;
      }
    }
  }
  const sortNumberMap = (
    source: Readonly<Record<string, number>> | undefined,
  ): Record<string, number> | undefined => {
    if (source === undefined) {
      return undefined;
    }
    const keys = Object.keys(source).sort();
    if (keys.length === 0) {
      return undefined;
    }
    const next: Record<string, number> = {};
    for (const key of keys) {
      next[key] = source[key]!;
    }
    return next;
  };
  const sortOverrideRecord = (
    source: Readonly<Partial<Record<string, AdvisorWeekdayOverride>>> | undefined,
  ): Record<string, AdvisorWeekdayOverride> | undefined => {
    if (source === undefined) {
      return undefined;
    }
    const keys = Object.keys(source).sort();
    if (keys.length === 0) {
      return undefined;
    }
    const next: Record<string, AdvisorWeekdayOverride> = {};
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined) {
        next[key] = value;
      }
    }
    return Object.keys(next).length > 0 ? next : undefined;
  };
  const snapshot = {
    bookingHorizonDays: doc.bookingHorizonDays,
    defaultWeekdayWindow: doc.defaultWeekdayWindow,
    slotIntervalMinutes: doc.slotIntervalMinutes,
    weekendDayIndices: [...doc.weekendDayIndices].sort((a, b) => a - b),
    weekdayOverrides:
      sortedWeekdayOverrides !== undefined && Object.keys(sortedWeekdayOverrides).length > 0
        ? sortedWeekdayOverrides
        : undefined,
    dateWindowOverrides: sortOverrideRecord(doc.dateWindowOverrides),
    dailyBookingCapOverrides: sortNumberMap(doc.dailyBookingCapOverrides),
    weeklyBookingCapOverrides: sortNumberMap(doc.weeklyBookingCapOverrides),
  };
  return JSON.stringify(snapshot);
}

function SchedulePageSkeleton(): ReactElement {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading schedule">
      <div className="rounded-xl border border-border/80 bg-muted/40 p-2">
        <div className="flex flex-wrap gap-1">
          <AdminSkeleton className="h-10 w-28 rounded-md" />
          <AdminSkeleton className="h-10 w-32 rounded-md" />
          <AdminSkeleton className="h-10 w-32 rounded-md" />
          <AdminSkeleton className="h-10 w-28 rounded-md" />
          <AdminSkeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
      <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
        <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
          <div className="flex gap-3">
            <AdminSkeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <AdminSkeleton className="h-5 w-52" />
              <AdminSkeleton className="h-4 w-full max-w-xl" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <AdminSkeleton className="h-4 w-24" />
            <AdminSkeleton className="h-11 w-full" />
          </div>
          <div className="space-y-2">
            <AdminSkeleton className="h-4 w-32" />
            <AdminSkeleton className="h-11 w-full" />
          </div>
          <AdminSkeleton className="h-24 md:col-span-2" />
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
        <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
          <AdminSkeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          <AdminSkeleton className="h-16 w-full rounded-none" />
          <AdminSkeleton className="h-16 w-full rounded-none" />
          <AdminSkeleton className="h-16 w-full rounded-none" />
        </CardContent>
      </Card>
    </div>
  );
}

type ScheduleLoadFailurePanelProps = {
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
};

function ScheduleLoadFailurePanel(props: ScheduleLoadFailurePanelProps): ReactElement {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-lg">Could not load schedule</CardTitle>
        <CardDescription>
          Check your connection and permissions, then try again. If the problem continues, contact support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.errorMessage !== null ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{props.errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="button" onClick={() => props.onRetry()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

type OverrideRowMode = 'default' | 'closed' | 'window';

function resolveOverrideRow(dow: number, doc: AdvisorBookingSettingsDocument): {
  readonly mode: OverrideRowMode;
  readonly start: string;
  readonly end: string;
} {
  const raw = doc.weekdayOverrides?.[String(dow)];
  if (raw === undefined) {
    return { mode: 'default', start: '09:00', end: '17:00' };
  }
  if (raw.kind === 'closed') {
    return { mode: 'closed', start: '09:00', end: '17:00' };
  }
  return { mode: 'window', start: raw.start, end: raw.end };
}

export function AdminAdvisorScheduleManager(): ReactElement {
  const [settings, setSettings] = useState<AdvisorBookingSettingsDocument | null>(null);
  const [lastSavedSettings, setLastSavedSettings] = useState<AdvisorBookingSettingsDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);
  const executeRetryLoad = useCallback((): void => {
    setIsLoading(true);
    setLoadErrorMessage(null);
    setRetryToken((previous) => previous + 1);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetch(BOOKING_SCHEDULE_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as { settings?: AdvisorBookingSettingsDocument; error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load schedule');
        }
        if (data.settings === undefined) {
          throw new Error('Invalid schedule response.');
        }
        return data.settings;
      })
      .then((doc) => {
        if (!cancelled) {
          const cloned = cloneSettings(doc);
          setSettings(cloned);
          setLastSavedSettings(cloneSettings(doc));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadErrorMessage(error instanceof Error ? error.message : 'Failed to load schedule.');
          notifyError(error instanceof Error ? error.message : 'Failed to load schedule.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);
  const normalized = useMemo(() => {
    if (settings === null) {
      return null;
    }
    return normalizeAdvisorBookingSettings(settings);
  }, [settings]);
  const [previewAnchorYmd] = useState<string>(() =>
    resolveAdvisorSchedulePreviewAnchorYmd(new Date(), PRIMARY_TIMEZONE),
  );
  const [previewWeekYmds, setPreviewWeekYmds] = useState<readonly string[]>(() =>
    listSunToSatYmdsForWeekContaining(
      resolveAdvisorSchedulePreviewAnchorYmd(new Date(), PRIMARY_TIMEZONE),
      PRIMARY_TIMEZONE,
    ),
  );
  const previewWeekRangeLabel: string | null = useMemo(
    () => formatPreviewWeekRangeLabel(previewWeekYmds, PRIMARY_TIMEZONE),
    [previewWeekYmds],
  );
  const executePreviewWeekChange = useCallback((sunToSatYmds: readonly string[]): void => {
    setPreviewWeekYmds(sunToSatYmds);
  }, []);
  const businessHours = useMemo(() => {
    if (normalized === null) {
      return [];
    }
    return buildFullCalendarBusinessHourSegments(normalized, previewWeekYmds);
  }, [normalized, previewWeekYmds]);
  const executeToggleWeekendDay = useCallback((dow: number): void => {
    setSettings((previous) => {
      if (previous === null) {
        return previous;
      }
      const set = new Set(previous.weekendDayIndices);
      if (set.has(dow)) {
        set.delete(dow);
      } else {
        set.add(dow);
      }
      return { ...previous, weekendDayIndices: [...set].sort((a, b) => a - b) };
    });
  }, []);
  const executeSetOverrideMode = useCallback((dow: number, mode: OverrideRowMode): void => {
    setSettings((previous) => {
      if (previous === null) {
        return previous;
      }
      const nextOverrides = { ...(previous.weekdayOverrides ?? {}) } as Record<string, AdvisorWeekdayOverride>;
      if (mode === 'default') {
        delete nextOverrides[String(dow)];
      } else if (mode === 'closed') {
        nextOverrides[String(dow)] = { kind: 'closed' };
      } else {
        const row = resolveOverrideRow(dow, previous);
        nextOverrides[String(dow)] = { kind: 'window', start: row.start, end: row.end };
      }
      return {
        ...previous,
        weekdayOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
      };
    });
  }, []);
  const executeSetOverrideWindow = useCallback((dow: number, start: string, end: string): void => {
    setSettings((previous) => {
      if (previous === null) {
        return previous;
      }
      const nextOverrides = { ...(previous.weekdayOverrides ?? {}) } as Record<string, AdvisorWeekdayOverride>;
      nextOverrides[String(dow)] = { kind: 'window', start, end };
      return { ...previous, weekdayOverrides: nextOverrides };
    });
  }, []);
  const executeSave = useCallback(async (): Promise<void> => {
    if (settings === null) {
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(BOOKING_SCHEDULE_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: PRIMARY_TIMEZONE,
          weekendDayIndices: settings.weekendDayIndices,
          defaultWeekdayWindow: settings.defaultWeekdayWindow,
          weekdayOverrides: settings.weekdayOverrides,
          dateWindowOverrides: settings.dateWindowOverrides,
          slotIntervalMinutes: settings.slotIntervalMinutes,
          dailyBookingCapOverrides: settings.dailyBookingCapOverrides,
          weeklyBookingCapOverrides: settings.weeklyBookingCapOverrides,
          bookingHorizonDays: settings.bookingHorizonDays,
        }),
      });
      const data = (await response.json()) as { settings?: AdvisorBookingSettingsDocument; error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      if (data.settings === undefined) {
        throw new Error('Invalid save response.');
      }
      const cloned = cloneSettings(data.settings);
      setSettings(cloned);
      setLastSavedSettings(cloneSettings(data.settings));
      notifySuccess('Your booking schedule is published to the API.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);
  const executeResetToSaved = useCallback((): void => {
    if (lastSavedSettings === null) {
      return;
    }
    setSettings(cloneSettings(lastSavedSettings));
  }, [lastSavedSettings]);
  const hasScheduleChanges: boolean = useMemo(() => {
    if (settings === null || lastSavedSettings === null) {
      return false;
    }
    return (
      serializeAdvisorBookingSettingsForComparison(settings) !==
      serializeAdvisorBookingSettingsForComparison(lastSavedSettings)
    );
  }, [lastSavedSettings, settings]);
  const isScheduleReady: boolean = !isLoading && settings !== null;
  return (
    <div className="mx-auto flex min-h-0 w-full flex-col pb-16">
      <div className={cn('space-y-8', adminFormStickyFooterScrollPaddingClass)}>
      <AdminPageHeader
        eyebrow="Operations"
        title="Booking schedule"
        description="Use the tabs to configure baseline hours, weekday rules, one-off dates, optional caps, and a template week preview. Live booking slots always follow the public availability API."
      />
      {isLoading ? <SchedulePageSkeleton /> : null}
      {!isLoading && settings === null ? (
        <ScheduleLoadFailurePanel errorMessage={loadErrorMessage} onRetry={executeRetryLoad} />
      ) : null}
      {!isLoading && settings !== null ? (
        <div data-admin-tour="page-schedule-calendar" className="space-y-6">
          <Tabs defaultValue="hours-grid" className="w-full">
            <TabsList
              aria-label="Schedule sections"
              className="flex h-auto min-h-11 w-full flex-wrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/50 p-1.5 shadow-sm"
            >
              <TabsTrigger value="hours-grid" className="min-h-10 gap-1.5 px-3 text-sm sm:px-4">
                <SlidersHorizontal className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Hours & grid
              </TabsTrigger>
              <TabsTrigger value="weekdays" className="min-h-10 gap-1.5 px-3 text-sm sm:px-4">
                <CalendarRange className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Weekday rules
              </TabsTrigger>
              <TabsTrigger value="dates" className="min-h-10 gap-1.5 px-3 text-sm sm:px-4">
                <CalendarDays className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Date overrides
              </TabsTrigger>
              <TabsTrigger value="caps" className="min-h-10 gap-1.5 px-3 text-sm sm:px-4">
                <BarChart3 className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Booking caps
              </TabsTrigger>
              <TabsTrigger value="preview" className="min-h-10 gap-1.5 px-3 text-sm sm:px-4">
                <Eye className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Week preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hours-grid" className="mt-6 outline-none">
              <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
              <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                      <SlidersHorizontal className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg tracking-tight">Hours & booking window</CardTitle>
                      <CardDescription className="text-pretty">
                        Timezone is fixed for this workspace. Set how far ahead clients may book, default weekday hours,
                        slot length, and which days count as weekends.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
                    {PRIMARY_TIMEZONE}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Gauge className="size-4 text-muted-foreground" aria-hidden />
                    Planning window
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="adv-timezone">IANA timezone</Label>
                      <Input
                        id="adv-timezone"
                        value={PRIMARY_TIMEZONE}
                        disabled
                        aria-readonly="true"
                        className="min-h-11 cursor-not-allowed font-mono text-sm opacity-90"
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">Read-only; aligned to your advisory region.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adv-horizon">Booking horizon (days)</Label>
                      <Input
                        id="adv-horizon"
                        type="number"
                        min={1}
                        max={366}
                        inputMode="numeric"
                        className="min-h-11"
                        value={settings.bookingHorizonDays}
                        onChange={(e) =>
                          setSettings({ ...settings, bookingHorizonDays: Number.parseInt(e.target.value, 10) || 1 })
                        }
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">Maximum days into the future that slots are offered.</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Clock className="size-4 text-muted-foreground" aria-hidden />
                    Default weekday hours
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Used for every weekday that is not a weekend and does not have a custom weekday rule. Use 24-hour{' '}
                    <span className="font-mono">HH:mm</span>.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="adv-def-start">Start</Label>
                      <Input
                        id="adv-def-start"
                        className="min-h-11 font-mono text-sm"
                        placeholder="08:00"
                        value={settings.defaultWeekdayWindow.start}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            defaultWeekdayWindow: { ...settings.defaultWeekdayWindow, start: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adv-def-end">End</Label>
                      <Input
                        id="adv-def-end"
                        className="min-h-11 font-mono text-sm"
                        placeholder="22:00"
                        value={settings.defaultWeekdayWindow.end}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            defaultWeekdayWindow: { ...settings.defaultWeekdayWindow, end: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="adv-interval">Slot length</Label>
                      <NativeSelect
                        id="adv-interval"
                        className="h-11 max-w-xs"
                        value={String(settings.slotIntervalMinutes)}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            slotIntervalMinutes: Number.parseInt(e.target.value, 10) as AdvisorBookingSettingsDocument['slotIntervalMinutes'],
                          })
                        }
                      >
                        <option value={30}>30 minutes between start times</option>
                        <option value={45}>45 minutes between start times</option>
                        <option value={60}>60 minutes between start times</option>
                        <option value={90}>90 minutes between start times</option>
                      </NativeSelect>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Weekend days</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Checked days are closed by default. You can still open a specific Saturday or Sunday from the Weekday
                    rules or Date overrides tabs.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
                    {DOW_LABELS.map((label, dow) => {
                      const checked = settings.weekendDayIndices.includes(dow);
                      const checkboxId = `adv-weekend-${dow}`;
                      return (
                        <Label
                          key={label}
                          className={cn(
                            'flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-xl border px-3 py-2.5 font-normal transition-colors',
                            checked ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-muted/25 hover:bg-muted/40',
                          )}
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={() => executeToggleWeekendDay(dow)}
                            className="shrink-0"
                          />
                          <span className="text-sm leading-none">{label}</span>
                        </Label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
            </TabsContent>
            <TabsContent value="weekdays" className="mt-6 outline-none">
            <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
              <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <CalendarRange className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">Weekday rules</CardTitle>
                    <CardDescription className="text-pretty">
                      Override the default for any day of the week — for example a shorter Friday or a working Saturday.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border" aria-label="Per weekday schedule overrides">
                  {DOW_LABELS.map((label, dow) => {
                    const row = resolveOverrideRow(dow, settings);
                    const isWeekendDefault = dow === 0 || dow === 6;
                    return (
                      <li
                        key={label}
                        className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:gap-6 sm:px-5 sm:py-4"
                      >
                        <div className="flex shrink-0 items-baseline gap-3 sm:w-36 sm:flex-col sm:items-start sm:gap-1">
                          <span className="text-sm font-semibold text-foreground">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {isWeekendDefault ? 'Often weekend' : 'Weekday'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <Label className="text-xs text-muted-foreground sm:sr-only" htmlFor={`adv-ov-mode-${dow}`}>
                            Schedule for {label}
                          </Label>
                          <NativeSelect
                            id={`adv-ov-mode-${dow}`}
                            className="h-11 w-full min-w-0 sm:max-w-md"
                            value={row.mode}
                            onChange={(e) => executeSetOverrideMode(dow, e.target.value as OverrideRowMode)}
                            aria-label={`${label} schedule mode`}
                          >
                            <option value="default">Follow default & weekend rules</option>
                            <option value="closed">Closed all day</option>
                            <option value="window">Custom hours only</option>
                          </NativeSelect>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
                          {row.mode === 'window' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="h-11 w-24 font-mono text-sm sm:w-26"
                                value={row.start}
                                onChange={(e) => executeSetOverrideWindow(dow, e.target.value, row.end)}
                                aria-label={`${label} window start`}
                              />
                              <span className="text-sm text-muted-foreground">–</span>
                              <Input
                                className="h-11 w-24 font-mono text-sm sm:w-26"
                                value={row.end}
                                onChange={(e) => executeSetOverrideWindow(dow, row.start, e.target.value)}
                                aria-label={`${label} window end`}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No custom window</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
            </TabsContent>
            <TabsContent value="dates" className="mt-6 outline-none">
            <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
              <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <CalendarDays className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">One-off dates</CardTitle>
                    <CardDescription className="text-pretty">
                      Highest priority: use for holidays, travel, or a single open Saturday. Replaces weekday and weekend
                      rules for that calendar date only ({PRIMARY_TIMEZONE}).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-6 pt-6 sm:px-6">
                <DateWindowOverrideEditor
                  scheduleTimeZone={PRIMARY_TIMEZONE}
                  value={settings.dateWindowOverrides ?? {}}
                  onChange={(next) =>
                    setSettings({
                      ...settings,
                      dateWindowOverrides: next !== undefined && Object.keys(next).length > 0 ? next : undefined,
                    })
                  }
                />
              </CardContent>
            </Card>
            </TabsContent>
            <TabsContent value="caps" className="mt-6 outline-none">
            <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
              <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <BarChart3 className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">Booking caps (optional)</CardTitle>
                    <CardDescription className="text-pretty">
                      Soft limits on how many active bookings count toward a calendar day or ISO week. Leave empty for
                      unlimited capacity. Day key:{' '}
                      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">yyyy-MM-dd</code> · Week key:{' '}
                      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">YYYY-Www</code> (example{' '}
                      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">2026-W24</code>).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-10 pt-6">
                <DailyCapEditor
                  scheduleTimeZone={PRIMARY_TIMEZONE}
                  value={settings.dailyBookingCapOverrides ?? {}}
                  onChange={(next) =>
                    setSettings({
                      ...settings,
                      dailyBookingCapOverrides: Object.keys(next).length > 0 ? next : undefined,
                    })
                  }
                />
                <Separator />
                <WeeklyCapEditor
                  scheduleTimeZone={PRIMARY_TIMEZONE}
                  value={settings.weeklyBookingCapOverrides ?? {}}
                  onChange={(next) =>
                    setSettings({
                      ...settings,
                      weeklyBookingCapOverrides: Object.keys(next).length > 0 ? next : undefined,
                    })
                  }
                />
              </CardContent>
            </Card>
            </TabsContent>
            <TabsContent value="preview" className="mt-6 outline-none">
            <Card className="overflow-hidden border-border/90 shadow-sm py-0 pb-6">
              <CardHeader className="border-b border-border/80 bg-muted/25 p-6">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Eye className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">Week preview</CardTitle>
                    <CardDescription className="text-pretty">
                      Gray cells are closed. Customer apps use the real-time availability API.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <p className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {previewWeekRangeLabel !== null ? (
                    <>
                      Showing {previewWeekRangeLabel} ({PRIMARY_TIMEZONE}). Opens on the current week; use prev / next
                      to inspect nearby weeks.
                    </>
                  ) : (
                    <>Use prev / next in the grid to inspect weeks ({PRIMARY_TIMEZONE}).</>
                  )}
                </p>
                <CalendarInner
                  businessHours={businessHours}
                  timeZone={PRIMARY_TIMEZONE}
                  initialAnchorYmd={previewAnchorYmd}
                  onVisibleWeekChange={executePreviewWeekChange}
                />
              </CardContent>
            </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
      </div>
      {isScheduleReady ? (
        <AdminFormStickyFooter
          isSaving={isSaving}
          isDisabled={isSaving || !hasScheduleChanges}
          onSave={() => void executeSave()}
          onReset={executeResetToSaved}
          isResetDisabled={!hasScheduleChanges}
        />
      ) : null}
    </div>
  );
}

type DailyCapEditorProps = {
  readonly scheduleTimeZone: string;
  readonly value: Readonly<Record<string, number>>;
  readonly onChange: (next: Record<string, number>) => void;
};

type ScheduleCapCalendarDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: 'day' | 'week' | 'date-override';
  readonly timeZone: string;
  readonly existingKeys: Readonly<Record<string, unknown>>;
  readonly selected: Date | undefined;
  readonly onSelectedChange: (next: Date | undefined) => void;
  readonly errorMessage: string | null;
  readonly onErrorMessageChange: (next: string | null) => void;
  readonly onConfirm: (key: string) => void;
};

function ScheduleCapCalendarDialog(props: ScheduleCapCalendarDialogProps): ReactElement {
  const confirmationKey: string | null =
    props.selected === undefined
      ? null
      : props.mode === 'week'
        ? resolveAdvisorWeeklyCapKeyFromSelection(props.selected, props.timeZone)
        : resolveAdvisorDailyCapKeyFromSelection(props.selected, props.timeZone);
  const executeConfirm = (): void => {
    if (confirmationKey === null) {
      props.onErrorMessageChange('Select a date on the calendar.');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(props.existingKeys, confirmationKey)) {
      props.onErrorMessageChange(
        props.mode === 'day'
          ? 'That date already has a cap.'
          : props.mode === 'week'
            ? 'That week already has a cap.'
            : 'That date already has a schedule override.',
      );
      return;
    }
    props.onConfirm(confirmationKey);
    props.onOpenChange(false);
  };
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-fit sm:max-w-fit" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {props.mode === 'day' ? 'Add per-day cap' : props.mode === 'week' ? 'Add per-week cap' : 'Add date override'}
          </DialogTitle>
          <DialogDescription>
            {props.mode === 'day'
              ? 'Pick the calendar date in your advisor timezone. The cap key is yyyy-MM-dd.'
              : props.mode === 'week'
                ? 'Pick any day in the week you want to cap. The key is the ISO week (YYYY-Www) for that week in your advisor timezone.'
                : 'Pick a calendar date. You can mark it closed or set a custom hours window for that day only.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-1">
          <Calendar
            mode="single"
            required={false}
            selected={props.selected}
            onSelect={(next) => {
              props.onSelectedChange(next);
              props.onErrorMessageChange(null);
            }}
            timeZone={props.timeZone}
            captionLayout="dropdown"
            className="rounded-lg border border-border bg-card p-2"
          />
          {confirmationKey !== null ? (
            <p className="font-mono text-sm text-muted-foreground">
              {props.mode === 'week' ? 'Week key: ' : 'Date key: '}
              <span className="text-foreground">{confirmationKey}</span>
            </p>
          ) : null}
          {props.errorMessage !== null ? (
            <Alert variant="destructive" className="max-w-sm">
              <AlertCircle />
              <AlertTitle>Cannot add</AlertTitle>
              <AlertDescription>{props.errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => executeConfirm()}>
            {props.mode === 'date-override' ? 'Add override' : 'Add cap'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DateOverrideRowMode = 'closed' | 'window';

function resolveDateOverrideRow(
  ymd: string,
  raw: Readonly<Partial<Record<string, AdvisorWeekdayOverride>>>,
): { readonly mode: DateOverrideRowMode; readonly start: string; readonly end: string } {
  const value = raw[ymd];
  if (value === undefined || value.kind === 'closed') {
    return { mode: 'closed', start: '09:00', end: '17:00' };
  }
  return { mode: 'window', start: value.start, end: value.end };
}

type DateWindowOverrideEditorProps = {
  readonly scheduleTimeZone: string;
  readonly value: Readonly<Partial<Record<string, AdvisorWeekdayOverride>>>;
  readonly onChange: (next: Record<string, AdvisorWeekdayOverride> | undefined) => void;
};

function DateWindowOverrideEditor(props: DateWindowOverrideEditorProps): ReactElement {
  const rows: readonly string[] = useMemo(() => Object.keys(props.value).sort(), [props.value]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [pickSelected, setPickSelected] = useState<Date | undefined>(undefined);
  const [pickError, setPickError] = useState<string | null>(null);
  const executeOpenPickDialog = (): void => {
    setPickSelected(undefined);
    setPickError(null);
    setIsAddDialogOpen(true);
  };
  const executePickDialogOpenChange = (open: boolean): void => {
    setIsAddDialogOpen(open);
    if (!open) {
      setPickSelected(undefined);
      setPickError(null);
    }
  };
  const executeSetRowMode = (ymd: string, mode: DateOverrideRowMode): void => {
    const next: Record<string, AdvisorWeekdayOverride> = { ...props.value } as Record<string, AdvisorWeekdayOverride>;
    if (mode === 'closed') {
      next[ymd] = { kind: 'closed' };
    } else {
      const row = resolveDateOverrideRow(ymd, props.value);
      next[ymd] = { kind: 'window', start: row.start, end: row.end };
    }
    props.onChange(next);
  };
  const executeSetRowWindow = (ymd: string, start: string, end: string): void => {
    const next: Record<string, AdvisorWeekdayOverride> = { ...props.value } as Record<string, AdvisorWeekdayOverride>;
    next[ymd] = { kind: 'window', start, end };
    props.onChange(next);
  };
  const executeRemoveRow = (ymd: string): void => {
    const next: Record<string, AdvisorWeekdayOverride> = { ...props.value } as Record<string, AdvisorWeekdayOverride>;
    delete next[ymd];
    props.onChange(Object.keys(next).length > 0 ? next : undefined);
  };
  const existingKeysForDialog: Readonly<Record<string, unknown>> = props.value as Readonly<Record<string, unknown>>;
  const rowCount: number = rows.length;
  return (
    <div className="space-y-6">
      {rowCount === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/90 bg-linear-to-b from-muted/40 to-muted/10 px-6 py-14 text-center sm:py-16">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15">
            <CalendarPlus className="size-7" aria-hidden />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">No one-off dates yet</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Add exceptions for holidays, PTO, or a single open Saturday. Each date overrides your weekday and weekend
            template for that calendar day only.
          </p>
          <Button type="button" className="mt-8 min-h-11 gap-2" onClick={() => executeOpenPickDialog()}>
            <Plus className="size-4" aria-hidden />
            Add date override
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active overrides</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each card is one calendar date in {props.scheduleTimeZone}.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {rowCount} {rowCount === 1 ? 'date' : 'dates'}
            </Badge>
          </div>
          <ul className="space-y-4" aria-label="Per-date schedule overrides">
            {rows.map((ymd) => {
              const row = resolveDateOverrideRow(ymd, props.value);
              return (
                <li key={ymd}>
                  <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-border/40 p-0">
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-4 sm:px-5">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="font-mono text-base font-semibold tracking-tight text-foreground sm:text-lg">
                            {ymd}
                          </CardTitle>
                          <Badge variant="outline" className="font-mono text-[0.65rem] font-normal uppercase tracking-wide">
                            {props.scheduleTimeZone}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs leading-relaxed sm:text-sm">
                          Overrides all other rules for this single day.
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10 shrink-0 gap-1.5 border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => executeRemoveRow(ymd)}
                        aria-label={`Remove override for ${ymd}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Remove
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2 lg:items-start lg:gap-8">
                      <div className="space-y-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Availability type
                        </Label>
                        <div className="grid grid-cols-1 gap-2 sm:max-w-md sm:grid-cols-2">
                          <Button
                            type="button"
                            variant={row.mode === 'closed' ? 'default' : 'outline'}
                            className="min-h-11 justify-center px-3 text-sm font-medium"
                            onClick={() => executeSetRowMode(ymd, 'closed')}
                            aria-pressed={row.mode === 'closed'}
                          >
                            Closed all day
                          </Button>
                          <Button
                            type="button"
                            variant={row.mode === 'window' ? 'default' : 'outline'}
                            className="min-h-11 justify-center px-3 text-sm font-medium"
                            onClick={() => executeSetRowMode(ymd, 'window')}
                            aria-pressed={row.mode === 'window'}
                          >
                            Custom hours
                          </Button>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Closed blocks every slot. Custom hours limits bookings to a window you define (24-hour{' '}
                          <span className="font-mono">HH:mm</span>).
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {row.mode === 'closed' ? 'Hours' : 'Open window'}
                        </Label>
                        {row.mode === 'closed' ? (
                          <div className="rounded-xl border border-dashed border-border/90 bg-muted/20 px-4 py-4">
                            <p className="text-sm font-medium text-foreground">No booking slots</p>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                              This calendar day stays fully closed. Switch to &ldquo;Custom hours&rdquo; if clients
                              should see specific start times.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-border/80 bg-muted/25 p-4 shadow-inner">
                            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground" htmlFor={`date-ov-${ymd}-start`}>
                                  Opens
                                </Label>
                                <Input
                                  id={`date-ov-${ymd}-start`}
                                  className="h-11 font-mono text-sm"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder="08:00"
                                  value={row.start}
                                  onChange={(e) => executeSetRowWindow(ymd, e.target.value, row.end)}
                                  aria-label={`${ymd} window start`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground" htmlFor={`date-ov-${ymd}-end`}>
                                  Until
                                </Label>
                                <Input
                                  id={`date-ov-${ymd}-end`}
                                  className="h-11 font-mono text-sm"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder="17:00"
                                  value={row.end}
                                  onChange={(e) => executeSetRowWindow(ymd, row.start, e.target.value)}
                                  aria-label={`${ymd} window end`}
                                />
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                              Slots are generated from Opens in steps of your slot length until the window end.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Need another exception?</p>
            <Button type="button" variant="secondary" className="min-h-11 w-full gap-2 sm:w-auto" onClick={() => executeOpenPickDialog()}>
              <Plus className="size-4" aria-hidden />
              Add date override
            </Button>
          </div>
        </>
      )}
      <ScheduleCapCalendarDialog
        open={isAddDialogOpen}
        onOpenChange={executePickDialogOpenChange}
        mode="date-override"
        timeZone={props.scheduleTimeZone}
        existingKeys={existingKeysForDialog}
        selected={pickSelected}
        onSelectedChange={setPickSelected}
        errorMessage={pickError}
        onErrorMessageChange={setPickError}
        onConfirm={(key) => {
          const next: Record<string, AdvisorWeekdayOverride> = {
            ...(props.value as Record<string, AdvisorWeekdayOverride>),
            [key]: { kind: 'closed' },
          };
          props.onChange(next);
        }}
      />
    </div>
  );
}

function DailyCapEditor(props: DailyCapEditorProps): ReactElement {
  const rows = Object.entries(props.value);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [pickSelected, setPickSelected] = useState<Date | undefined>(undefined);
  const [pickError, setPickError] = useState<string | null>(null);
  const executeOpenPickDialog = (): void => {
    setPickSelected(undefined);
    setPickError(null);
    setIsAddDialogOpen(true);
  };
  const executePickDialogOpenChange = (open: boolean): void => {
    setIsAddDialogOpen(open);
    if (!open) {
      setPickSelected(undefined);
      setPickError(null);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Per-day caps</p>
          <p className="text-xs text-muted-foreground">Limit total bookings on specific dates.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No per-day caps. Add one when you need to throttle a busy date.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Per-day booking caps">
          {rows.map(([date, cap]) => (
            <li
              key={date}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:items-center"
            >
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`day-key-${date}`}>
                  Date key
                </Label>
                <Input
                  id={`day-key-${date}`}
                  className="h-10 w-40 font-mono text-sm"
                  value={date}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`day-cap-${date}`}>
                  Max bookings
                </Label>
                <Input
                  id={`day-cap-${date}`}
                  type="number"
                  min={1}
                  className="h-10 w-24"
                  value={cap}
                  onChange={(e) => {
                    const next = { ...props.value, [date]: Number.parseInt(e.target.value, 10) || 1 };
                    props.onChange(next);
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => {
                  const next = { ...props.value };
                  delete next[date];
                  props.onChange(next);
                }}
                aria-label={`Remove cap for ${date}`}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => executeOpenPickDialog()}>
        <Plus className="size-3.5" aria-hidden />
        Add day cap
      </Button>
      <ScheduleCapCalendarDialog
        open={isAddDialogOpen}
        onOpenChange={executePickDialogOpenChange}
        mode="day"
        timeZone={props.scheduleTimeZone}
        existingKeys={props.value}
        selected={pickSelected}
        onSelectedChange={setPickSelected}
        errorMessage={pickError}
        onErrorMessageChange={setPickError}
        onConfirm={(key) => props.onChange({ ...props.value, [key]: 1 })}
      />
    </div>
  );
}

type WeeklyCapEditorProps = {
  readonly scheduleTimeZone: string;
  readonly value: Readonly<Record<string, number>>;
  readonly onChange: (next: Record<string, number>) => void;
};

function WeeklyCapEditor(props: WeeklyCapEditorProps): ReactElement {
  const rows = Object.entries(props.value);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [pickSelected, setPickSelected] = useState<Date | undefined>(undefined);
  const [pickError, setPickError] = useState<string | null>(null);
  const executeOpenPickDialog = (): void => {
    setPickSelected(undefined);
    setPickError(null);
    setIsAddDialogOpen(true);
  };
  const executePickDialogOpenChange = (open: boolean): void => {
    setIsAddDialogOpen(open);
    if (!open) {
      setPickSelected(undefined);
      setPickError(null);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Per-week caps</p>
        <p className="text-xs text-muted-foreground">Limit bookings across an ISO week (any day in the week maps to the same key).</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No per-week caps. Use this for seasonal load balancing.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Per-week booking caps">
          {rows.map(([week, cap]) => (
            <li
              key={week}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:items-center"
            >
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`week-key-${week}`}>
                  Week key
                </Label>
                <Input
                  id={`week-key-${week}`}
                  className="h-10 w-36 font-mono text-sm"
                  value={week}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`week-cap-${week}`}>
                  Max bookings
                </Label>
                <Input
                  id={`week-cap-${week}`}
                  type="number"
                  min={1}
                  className="h-10 w-24"
                  value={cap}
                  onChange={(e) => {
                    const next = { ...props.value, [week]: Number.parseInt(e.target.value, 10) || 1 };
                    props.onChange(next);
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => {
                  const next = { ...props.value };
                  delete next[week];
                  props.onChange(next);
                }}
                aria-label={`Remove cap for week ${week}`}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => executeOpenPickDialog()}>
        <Plus className="size-3.5" aria-hidden />
        Add week cap
      </Button>
      <ScheduleCapCalendarDialog
        open={isAddDialogOpen}
        onOpenChange={executePickDialogOpenChange}
        mode="week"
        timeZone={props.scheduleTimeZone}
        existingKeys={props.value}
        selected={pickSelected}
        onSelectedChange={setPickSelected}
        errorMessage={pickError}
        onErrorMessageChange={setPickError}
        onConfirm={(key) => props.onChange({ ...props.value, [key]: 1 })}
      />
    </div>
  );
}

export function AdminAdvisorSchedulePageContent(): ReactElement {
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminAdvisorScheduleManager />
    </section>
  );
}
