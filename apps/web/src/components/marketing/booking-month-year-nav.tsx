'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  addManilaYearMonth,
  buildManilaYearMonth,
  formatManilaMonthLabel,
  parseManilaYearMonth,
  resolveManilaYearOptions,
} from '@/lib/marketing/manila-year-month';
import { cn } from '@/lib/utils';

const MANILA_MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const MONTH_PICKER_TRIGGER_CLASS =
  'rounded-sm px-0.5 text-sm font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

type BookingMonthYearNavProps = {
  readonly visibleManilaYearMonth: string;
  readonly onVisibleManilaYearMonthChange: (value: string) => void;
  readonly onNavigate?: () => void;
};

function navigateVisibleMonth(
  props: BookingMonthYearNavProps,
  nextValue: string,
): void {
  props.onNavigate?.();
  props.onVisibleManilaYearMonthChange(nextValue);
}

/**
 * Month navigation for booking calendars — prev/next arrows plus clickable month and year pickers.
 */
export function BookingMonthYearNav(props: BookingMonthYearNavProps): ReactElement {
  const { year, month } = parseManilaYearMonth(props.visibleManilaYearMonth);
  const monthLabel = formatManilaMonthLabel(month, 'MMMM');
  const yearOptions = useMemo(
    () => resolveManilaYearOptions(props.visibleManilaYearMonth),
    [props.visibleManilaYearMonth],
  );
  const handlePreviousMonth = (): void => {
    navigateVisibleMonth(props, addManilaYearMonth(props.visibleManilaYearMonth, -1));
  };
  const handleNextMonth = (): void => {
    navigateVisibleMonth(props, addManilaYearMonth(props.visibleManilaYearMonth, 1));
  };
  const handleMonthChange = (value: string): void => {
    navigateVisibleMonth(props, buildManilaYearMonth(year, Number(value)));
  };
  const handleYearChange = (value: string): void => {
    navigateVisibleMonth(props, buildManilaYearMonth(Number(value), month));
  };
  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label="Previous month"
        onClick={handlePreviousMonth}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={MONTH_PICKER_TRIGGER_CLASS}
              aria-label={`Change month, currently ${monthLabel}`}
            >
              {monthLabel}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52 p-2">
            <DropdownMenuRadioGroup value={String(month)} onValueChange={handleMonthChange}>
              <div className="grid grid-cols-3 gap-1">
                {MANILA_MONTH_NUMBERS.map((monthNumber) => (
                  <DropdownMenuRadioItem
                    key={monthNumber}
                    value={String(monthNumber)}
                    className={cn(
                      'justify-center pl-2',
                      monthNumber === month && 'bg-accent text-accent-foreground',
                    )}
                  >
                    {formatManilaMonthLabel(monthNumber, 'MMM')}
                  </DropdownMenuRadioItem>
                ))}
              </div>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={MONTH_PICKER_TRIGGER_CLASS}
              aria-label={`Change year, currently ${year}`}
            >
              {year}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-60 w-28 overflow-y-auto">
            <DropdownMenuRadioGroup value={String(year)} onValueChange={handleYearChange}>
              {yearOptions.map((yearOption) => (
                <DropdownMenuRadioItem key={yearOption} value={String(yearOption)}>
                  {yearOption}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label="Next month"
        onClick={handleNextMonth}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
