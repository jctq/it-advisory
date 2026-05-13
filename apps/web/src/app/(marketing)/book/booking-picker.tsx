'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { cn } from '@/lib/utils';

const TIME_SLOTS: readonly string[] = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
];

export function BookingPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizSessionIdFromUrl = searchParams.get('sessionId')?.trim() ?? '';
  const hasValidQuizSessionParam = /^[a-f\d]{24}$/i.test(quizSessionIdFromUrl);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>('11:00 AM');

  const monthLabel = format(visibleMonth, 'MMMM yyyy');
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [visibleMonth]);

  const executeConfirm = (): void => {
    if (!selectedDate || !selectedTime) {
      return;
    }
    const dateParam = format(selectedDate, 'yyyy-MM-dd');
    const encodedTime = encodeURIComponent(selectedTime);
    const sessionSuffix =
      hasValidQuizSessionParam && quizSessionIdFromUrl.length > 0
        ? `&sessionId=${encodeURIComponent(quizSessionIdFromUrl)}`
        : '';
    router.push(`/confirmation?date=${dateParam}&time=${encodedTime}${sessionSuffix}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-balance text-3xl font-semibold tracking-tight">Choose a date and time</h1>
      <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
        Select a slot in Philippine Time ({PRIMARY_TIMEZONE}). Calendar integration with your database can
        replace these sample openings later.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => setVisibleMonth((previous) => subMonths(previous, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => setVisibleMonth((previous) => addMonths(previous, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, visibleMonth);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'aspect-square rounded-lg text-sm font-medium transition-colors',
                    !inMonth && 'cursor-default opacity-0',
                    inMonth && !isSelected && 'hover:bg-muted',
                    inMonth && isToday && !isSelected && 'border border-primary/40',
                    isSelected && 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-foreground">Available times</h2>
            <p className="mt-1 text-xs text-muted-foreground">Philippine Time · {PRIMARY_TIMEZONE}</p>
            <ul className="mt-4 grid gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTime === slot;
                return (
                  <li key={slot}>
                    <button
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50',
                      )}
                    >
                      {slot}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!selectedDate || !selectedTime}
            onClick={executeConfirm}
          >
            Confirm booking
          </Button>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link href="/service">Back to service details</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
