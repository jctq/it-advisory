'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CalendarClock, CheckCircle2, Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { isPlausibleMarketingQuizSessionRef } from '@/lib/marketing/quiz-session-marketing-ref';

const BOOKINGS_API_URL = '/api/bookings';

type ConfirmationStatus = 'pending' | 'success' | 'error' | 'invalid';

type ConfirmationFlowProps = {
  readonly displayDate: string;
  readonly displayTime: string;
  readonly dateRaw: string;
  readonly timeRaw: string;
  /** When set, booking API links this quiz row (must belong to the visitor). */
  readonly quizSessionIdRaw?: string;
};

/**
 * Creates the booking from the URL slot, then drives the UI from the result.
 * The server page must not claim success until this flow completes — otherwise users see a false positive.
 */
export function ConfirmationFlow(props: ConfirmationFlowProps): ReactElement {
  const router = useRouter();
  const [status, setStatus] = useState<ConfirmationStatus>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRunRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    const trimmedDate = props.dateRaw.trim();
    const trimmedTime = props.timeRaw.trim();
    if (trimmedDate.length === 0 || trimmedTime.length === 0) {
      queueMicrotask(() => {
        setStatus('invalid');
      });
      return;
    }
    hasRunRef.current = true;
    void (async (): Promise<void> => {
      try {
        const trimmedQuizSessionId = props.quizSessionIdRaw?.trim() ?? '';
        const body: Record<string, string> = {
          date: trimmedDate,
          time: trimmedTime,
          serviceKey: 'project-rescue',
        };
        if (isPlausibleMarketingQuizSessionRef(trimmedQuizSessionId)) {
          body.quizSessionId = trimmedQuizSessionId;
        }
        const response = await fetch(BOOKINGS_API_URL, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : `Booking could not be saved (${response.status}).`;
          setErrorMessage(message);
          setStatus('error');
          return;
        }
        void router.refresh();
        setStatus('success');
      } catch {
        setErrorMessage('Network error while saving your booking. Check your connection and try again.');
        setStatus('error');
      }
    })();
  }, [props.dateRaw, props.timeRaw, props.quizSessionIdRaw, router]);
  if (status === 'invalid') {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center md:py-28">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Missing booking details</h1>
        <p className="mt-3 text-muted-foreground">Open this page from the booking flow with a date and time selected.</p>
        <Button asChild className="mt-8" size="lg">
          <Link href="/book">Go to booking</Link>
        </Button>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center md:py-28">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <p className="mt-6 text-sm font-medium text-foreground">Confirming your booking…</p>
        <p className="mt-2 text-sm text-muted-foreground">Please wait while we save your slot.</p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center md:py-28">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">We could not save your booking</h1>
        <p className="mt-3 text-muted-foreground">{errorMessage ?? 'Something went wrong.'}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/book">Try again</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-9" aria-hidden />
      </div>
      <h1 className="mt-8 text-balance text-3xl font-semibold tracking-tight text-foreground">You&apos;re all set!</h1>
      <p className="mt-3 text-muted-foreground">
        Your consultation is reserved. A calendar invite and remote meeting link can be wired when email delivery is
        connected.
      </p>
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-left shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Booking summary</h2>
        <dl className="mt-4 space-y-4">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">When</dt>
              <dd className="text-sm font-semibold text-foreground">
                {props.displayDate}
                <span className="font-normal text-muted-foreground"> · </span>
                {props.displayTime}
              </dd>
              <dd className="text-xs text-muted-foreground">{PRIMARY_TIMEZONE}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Video className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Format</dt>
              <dd className="text-sm font-semibold text-foreground">Zoom meeting</dd>
              <dd className="text-xs text-muted-foreground">Link will be included in your confirmation email</dd>
            </div>
          </div>
        </dl>
      </div>
      <Button asChild className="mt-10" size="lg" variant="outline">
        <Link href="/">Back to home</Link>
      </Button>
    </>
  );
}