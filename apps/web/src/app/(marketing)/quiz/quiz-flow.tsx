'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QUIZ_STEPS, QUIZ_TOTAL_STEPS } from '@/lib/marketing/quiz-steps';
import { cn } from '@/lib/utils';

export function QuizFlow() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const currentStep = QUIZ_STEPS[stepIndex];
  const progressPercent = useMemo(
    () => Math.round(((stepIndex + 1) / QUIZ_TOTAL_STEPS) * 100),
    [stepIndex],
  );
  if (!currentStep) {
    return null;
  }
  const selectedKey = currentStep.id;
  const selectedValue = selections[selectedKey];

  const executeSelectOption = (value: string): void => {
    setSelections((previous) => ({ ...previous, [selectedKey]: value }));
  };

  const executeGoNext = (): void => {
    if (stepIndex >= QUIZ_TOTAL_STEPS - 1) {
      router.push('/recommendation');
      return;
    }
    setStepIndex((previous) => previous + 1);
  };

  const executeGoBack = (): void => {
    if (stepIndex <= 0) {
      return;
    }
    setStepIndex((previous) => previous - 1);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {QUIZ_TOTAL_STEPS}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        Guided diagnostic
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        One question at a time — tap an answer to continue. Your recommendation updates based on what you
        choose.
      </p>
      <h2 className="mt-10 text-lg font-medium text-foreground">{currentStep.question}</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2" role="list">
        {currentStep.options.map((option) => {
          const isSelected = selectedValue === option;
          return (
            <li key={option}>
              <button
                type="button"
                onClick={() => executeSelectOption(option)}
                className={cn(
                  'flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground ring-2 ring-primary/30'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50',
                )}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" asChild>
          <Link href="/" className="gap-1">
            <ChevronLeft className="size-4" aria-hidden />
            Home
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={executeGoBack}>
              Back
            </Button>
          ) : null}
          <Button type="button" onClick={executeGoNext} disabled={!selectedValue}>
            {stepIndex >= QUIZ_TOTAL_STEPS - 1 ? 'See recommendation' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
