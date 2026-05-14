'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';

import { cn } from '@/lib/utils';

import 'react-day-picker/style.css';

export type CalendarProps = DayPickerProps;

/**
 * Calendar built on React DayPicker with default styles and theme-aligned accents.
 * @see https://ui.shadcn.com/docs/components/radix/calendar
 */
function Calendar({ className, classNames, components, ...props }: CalendarProps): React.JSX.Element {
  return (
    <div
      className={cn(
        '[--rdp-accent-color:var(--primary)] [--rdp-accent-background-color:var(--accent)]',
        className,
      )}
    >
      <DayPicker
        classNames={classNames}
        components={{
          Chevron: ({ className: chevronClassName, orientation, ...rest }) => {
            if (orientation === 'left') {
              return <ChevronLeft className={cn('size-4', chevronClassName)} aria-hidden {...rest} />;
            }
            if (orientation === 'right') {
              return <ChevronRight className={cn('size-4', chevronClassName)} aria-hidden {...rest} />;
            }
            if (orientation === 'down') {
              return <ChevronDown className={cn('size-4', chevronClassName)} aria-hidden {...rest} />;
            }
            return <ChevronUp className={cn('size-4', chevronClassName)} aria-hidden {...rest} />;
          },
          ...components,
        }}
        {...props}
      />
    </div>
  );
}

export { Calendar };
