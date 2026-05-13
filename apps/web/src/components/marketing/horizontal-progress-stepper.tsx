'use client';

import { type ReactElement } from 'react';
import { cn } from '@/lib/utils';

export type HorizontalProgressStepStatus = 'complete' | 'current' | 'upcoming';

export type HorizontalProgressStep = {
  readonly id: string;
  readonly label: string;
  readonly status: HorizontalProgressStepStatus;
};

export type HorizontalProgressStepperProps = {
  readonly steps: readonly HorizontalProgressStep[];
  readonly ariaLabel: string;
  readonly className?: string;
  readonly isStepInteractive?: (params: {
    readonly stepIndex: number;
    readonly step: HorizontalProgressStep;
  }) => boolean;
  readonly onStepClick?: (stepIndex: number) => void;
};

function resolveActiveStepIndex(steps: readonly HorizontalProgressStep[]): number {
  const currentIndex = steps.findIndex((step) => step.status === 'current');
  if (currentIndex >= 0) {
    return currentIndex;
  }
  const completedCount = steps.filter((step) => step.status === 'complete').length;
  return Math.min(Math.max(0, completedCount - 1), Math.max(0, steps.length - 1));
}

/**
 * Desktop (lg+) horizontal process stepper: numbered milestones, labels beneath,
 * and connector segments that fill as earlier steps are completed.
 */
export function HorizontalProgressStepper(props: HorizontalProgressStepperProps): ReactElement {
  const { steps, ariaLabel, className, isStepInteractive, onStepClick } = props;
  const activeIndex = resolveActiveStepIndex(steps);
  const isConnectorCompleteAfter = (stepIndex: number): boolean => activeIndex > stepIndex;
  const isConnectorCompleteBefore = (stepIndex: number): boolean =>
    stepIndex > 0 && activeIndex > stepIndex - 1;
  return (
    <nav aria-label={ariaLabel} className={cn('hidden w-full lg:block', className)}>
      <ol className="flex w-full items-start">
        {steps.map((step, stepIndex) => {
          const stepNumber = stepIndex + 1;
          const isInteractive =
            onStepClick !== undefined &&
            isStepInteractive !== undefined &&
            isStepInteractive({ stepIndex, step }) === true;
          const lineSegmentClassName =
            'h-[2px] min-h-[2px] shrink-0 self-center min-w-0 flex-1 transition-colors duration-200 motion-reduce:transition-none';
          const leftLineClassName = cn(
            lineSegmentClassName,
            stepIndex === 0
              ? 'bg-transparent'
              : isConnectorCompleteBefore(stepIndex)
                ? 'bg-border'
                : 'bg-border',
          );
          const rightLineClassName = cn(
            lineSegmentClassName,
            stepIndex === steps.length - 1
              ? 'bg-transparent'
              : isConnectorCompleteAfter(stepIndex)
                ? 'bg-border'
                : 'bg-border',
          );
          const circleClassName = cn(
            'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none',
            step.status === 'complete' && 'bg-green-800 text-white shadow-sm dark:bg-green-900',
            step.status === 'current' && 'bg-primary text-primary-foreground shadow-sm',
            step.status === 'upcoming' && 'bg-muted text-muted-foreground',
          );
          const labelClassName = cn(
            'mt-3 block w-full max-w-[10rem] text-pretty text-center text-sm font-medium leading-snug sm:max-w-none',
            step.status === 'current' ? 'text-foreground' : 'text-muted-foreground',
          );
          const stepBody = (
            <>
              <div className="flex h-10 w-full min-w-0 shrink-0 items-center">
                <span className={leftLineClassName} aria-hidden />
                <span className={circleClassName}>{stepNumber}</span>
                <span className={rightLineClassName} aria-hidden />
              </div>
              <span className={labelClassName}>{step.label}</span>
            </>
          );
          const itemClassName = 'flex min-w-0 flex-1 flex-col items-stretch';
          const liAriaCurrent = step.status === 'current' ? 'step' : undefined;
          if (isInteractive) {
            return (
              <li key={step.id} className={itemClassName} aria-current={liAriaCurrent}>
                <button
                  type="button"
                  className={cn(
                    'group flex w-full flex-col rounded-xl py-1 transition-colors',
                    'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
                  )}
                  onClick={() => onStepClick?.(stepIndex)}
                  aria-label={`Go to ${step.label}`}
                >
                  {stepBody}
                </button>
              </li>
            );
          }
          return (
            <li key={step.id} className={itemClassName} aria-current={liAriaCurrent}>
              <div className="py-1">{stepBody}</div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
