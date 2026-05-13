'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Lock,
  Shield,
  Video,
} from 'lucide-react';
import { PROJECT_RESCUE_SERVICE_TITLE, PROJECT_RESCUE_SESSION_DURATION } from '@it-advisory/diagnostic-core/project-rescue-service-context';
import { HorizontalProgressStepper } from '@/components/marketing/horizontal-progress-stepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import {
  buildMarketingBookSessionPath,
  buildMarketingQuizSessionPath,
  isPlausibleMarketingQuizSessionRef,
} from '@/lib/marketing/quiz-session-marketing-ref';

const BOOKINGS_API_URL = '/api/bookings';
const QUIZ_SESSION_API_URL = '/api/quiz/session';
/** Matches `SiteHeader` (`h-16`) so booking progress sticks below the marketing nav. */
const MARKETING_SITE_HEADER_HEIGHT_PX = 64;

const TIME_SLOTS: readonly string[] = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '07:00 PM',
];

const CHECKOUT_AMOUNT_LABEL = '₱6,000.00';

type BookingSlotPhase = 'date' | 'details' | 'payment';

type BookingPhase = BookingSlotPhase | 'processing' | 'success' | 'error';

type PaymentMethodId = 'card' | 'gcash' | 'maya' | 'bank_transfer' | 'paypal';

const PAYMENT_METHOD_OPTIONS: readonly {
  readonly id: PaymentMethodId;
  readonly label: string;
  readonly hint: string;
}[] = [
  { id: 'card', label: 'Credit / Debit Card', hint: 'Visa · Mastercard · JCB' },
  { id: 'gcash', label: 'GCash', hint: 'Pay with GCash' },
  { id: 'maya', label: 'Maya', hint: 'Pay with Maya' },
  { id: 'bank_transfer', label: 'Bank transfer', hint: 'BPI · BDO · UnionBank' },
  { id: 'paypal', label: 'PayPal', hint: 'Pay with PayPal' },
];

const BOOKING_STEPS: readonly {
  readonly id: BookingSlotPhase;
  /** Uppercase label in the desktop stepper (matches quiz template progress). */
  readonly barLabel: string;
  /** Title case headline on the mobile summary row. */
  readonly headline: string;
}[] = [
  { id: 'date', barLabel: 'DATE & TIME', headline: 'Date & Time' },
  { id: 'details', barLabel: 'YOUR DETAILS', headline: 'Your details' },
  { id: 'payment', barLabel: 'PAYMENT', headline: 'Payment' },
];

function resolveStepStatus(params: {
  readonly stepIndex: number;
  readonly activeStepIndex: number;
}): 'complete' | 'current' | 'upcoming' {
  if (params.stepIndex < params.activeStepIndex) {
    return 'complete';
  }
  if (params.stepIndex === params.activeStepIndex) {
    return 'current';
  }
  return 'upcoming';
}

function BookingStepper(props: { readonly activePhase: BookingSlotPhase }): ReactElement {
  const activeStepIndex = BOOKING_STEPS.findIndex((s) => s.id === props.activePhase);
  const resolvedIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const currentStep = BOOKING_STEPS[resolvedIndex] ?? BOOKING_STEPS[0];
  const currentHeadline = currentStep?.headline ?? '';
  return (
    <>
      <div
        className="flex flex-col gap-2 lg:hidden"
        role="group"
        aria-label={`Booking checkout: step ${resolvedIndex + 1} of ${BOOKING_STEPS.length}, ${currentHeadline}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Step {resolvedIndex + 1} of {BOOKING_STEPS.length}
          </p>
          <p className="min-w-0 truncate text-right text-sm font-semibold text-foreground">{currentHeadline}</p>
        </div>
        <div className="flex items-center gap-1">
          {BOOKING_STEPS.map((step, stepIndex) => {
            const status = resolveStepStatus({ stepIndex, activeStepIndex: resolvedIndex });
            const barClassName = cn(
              'h-1.5 w-full rounded-full transition-colors',
              status === 'complete' ? 'bg-primary' : status === 'current' ? 'bg-primary/60' : 'bg-muted',
            );
            return (
              <div key={step.id} className="flex min-h-11 min-w-0 flex-1 items-center px-0.5">
                <span className={barClassName} aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
      <HorizontalProgressStepper
        className="rounded-2xl border border-border bg-card px-4 py-6 shadow-xs"
        ariaLabel={`Booking checkout: step ${resolvedIndex + 1} of ${BOOKING_STEPS.length}, ${currentHeadline}`}
        steps={BOOKING_STEPS.map((step, index) => ({
          id: step.id,
          label: step.headline,
          status: resolveStepStatus({ stepIndex: index, activeStepIndex: resolvedIndex }),
        }))}
      />
    </>
  );
}

export type BookingPickerProps = {
  /** When set (from `/book/[sessionRef]`), attaches checkout to that diagnostic row; legacy `?sessionId=` on `/book` redirects here. */
  readonly pathSessionRef?: string | null;
};

/**
 * Multi-step marketing checkout: slot selection, contact capture, mock payment choice, then booking persistence.
 */
export function BookingPicker(props: BookingPickerProps = {}): ReactElement {
  const { pathSessionRef } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useLayoutEffect(() => {
    const hasPathRef =
      pathSessionRef !== undefined && pathSessionRef !== null && pathSessionRef.trim().length > 0;
    if (hasPathRef) {
      return;
    }
    if (pathname !== '/book') {
      return;
    }
    const fromQuery = searchParams.get('sessionId')?.trim() ?? '';
    if (!isPlausibleMarketingQuizSessionRef(fromQuery)) {
      return;
    }
    router.replace(buildMarketingBookSessionPath(fromQuery));
  }, [pathSessionRef, pathname, router, searchParams]);
  const quizSessionRef = useMemo((): string => {
    if (pathSessionRef !== undefined && pathSessionRef !== null) {
      const trimmed = pathSessionRef.trim();
      return isPlausibleMarketingQuizSessionRef(trimmed) ? trimmed : '';
    }
    return searchParams.get('sessionId')?.trim() ?? '';
  }, [pathSessionRef, searchParams]);
  const hasValidQuizSessionParam = isPlausibleMarketingQuizSessionRef(quizSessionRef);
  const [phase, setPhase] = useState<BookingPhase>('date');
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>('11:00 AM');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>('card');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPaymentLabel, setSuccessPaymentLabel] = useState<string>('');
  const bookingProgressStickySentinelRef = useRef<HTMLDivElement | null>(null);
  const [isBookingProgressPinned, setIsBookingProgressPinned] = useState<boolean>(false);

  useEffect(() => {
    if (phase !== 'date' && phase !== 'details' && phase !== 'payment') {
      return;
    }
    const sentinel = bookingProgressStickySentinelRef.current;
    if (sentinel === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry === undefined) {
          return;
        }
        setIsBookingProgressPinned(!entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: `-${MARKETING_SITE_HEADER_HEIGHT_PX}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [phase]);

  useEffect(() => {
    const keys = Object.keys(fieldErrors);
    if (keys.length === 0) {
      return;
    }
    const idByField: Record<string, string> = {
      fullName: 'booking-full-name',
      email: 'booking-email',
      phone: 'booking-phone',
    };
    const firstKey = ['fullName', 'email', 'phone'].find((key) => fieldErrors[key] !== undefined);
    if (firstKey === undefined) {
      return;
    }
    const elementId = idByField[firstKey];
    if (elementId === undefined) {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(elementId)?.focus();
    });
  }, [fieldErrors]);

  const monthLabel = format(visibleMonth, 'MMMM yyyy');
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [visibleMonth]);

  const displayDateLong =
    selectedDate !== null
      ? format(selectedDate, 'EEEE, MMMM d, yyyy')
      : '';
  const displayTimeLabel = selectedTime ?? '';
  const activeDiagnosticHref = hasValidQuizSessionParam
    ? buildMarketingQuizSessionPath(quizSessionRef)
    : '/quiz';

  const executeContinueFromDate = (): void => {
    if (!selectedDate || !selectedTime) {
      return;
    }
    setPhase('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeContinueFromDetails = (): void => {
    const nextErrors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      nextErrors.fullName = 'Enter your full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (trimmedPhone.replace(/\s/g, '').length < 7) {
      nextErrors.phone = 'Enter a valid phone number.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setPhase('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executePay = async (): Promise<void> => {
    if (!selectedDate || !selectedTime || paymentMethod === null) {
      return;
    }
    const methodOption = PAYMENT_METHOD_OPTIONS.find((m) => m.id === paymentMethod);
    const resolvedPaymentLabel = methodOption?.label ?? paymentMethod;
    setPhase('processing');
    setErrorMessage(null);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 900);
    });
    const dateParam = format(selectedDate, 'yyyy-MM-dd');
    const body: Record<string, string> = {
      date: dateParam,
      time: selectedTime,
      serviceKey: 'project-rescue',
      customerName: fullName.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      paymentMethod,
    };
    const trimmedCompany = company.trim();
    if (trimmedCompany.length > 0) {
      body.customerCompany = trimmedCompany;
    }
    if (hasValidQuizSessionParam && quizSessionRef.length > 0) {
      body.quizSessionId = quizSessionRef;
    }
    try {
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
        setPhase('error');
        return;
      }
      await fetch(QUIZ_SESSION_API_URL, { method: 'DELETE', credentials: 'include' });
      void router.refresh();
      setSuccessPaymentLabel(resolvedPaymentLabel);
      setPhase('success');
    } catch {
      setErrorMessage('Network error while saving your booking. Check your connection and try again.');
      setPhase('error');
    }
  };

  const executeBackToDate = (): void => {
    setFieldErrors({});
    setPhase('date');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeBackToDetails = (): void => {
    setPhase('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeRetryFromError = (): void => {
    setPhase('payment');
    setErrorMessage(null);
  };

  if (phase === 'processing') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 md:py-24">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            4
          </span>
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Confirming your booking</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please wait while we confirm your booking.</p>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-border bg-primary/5 px-6 py-12">
          <div className="flex size-28 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-12 text-primary" aria-hidden />
          </div>
          <Loader2 className="mt-8 size-8 animate-spin text-primary" aria-hidden />
          <p className="mt-6 text-center text-sm font-semibold text-foreground">Processing your payment…</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">This will only take a few seconds.</p>
        </div>
        <div className="mt-8 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Shield className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            <span className="font-semibold">Do not close this window or refresh the page.</span>
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 md:py-24">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">We could not complete checkout</h1>
        <p className="mt-3 text-muted-foreground">{errorMessage ?? 'Something went wrong.'}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={executeRetryFromError}>
            Try again
          </Button>
          <Button type="button" size="lg" variant="outline" asChild>
            <Link href={activeDiagnosticHref}>Back to diagnostic</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="mx-auto max-w-xl px-6 py-12 md:py-20">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-11" aria-hidden />
          </div>
          <h1 className="mt-8 text-balance text-3xl font-semibold tracking-tight text-foreground">Booking confirmed!</h1>
          <p className="mt-2 text-muted-foreground">Your consultation is all set.</p>
        </div>
        <div className="mt-10 space-y-4 rounded-2xl border border-border bg-card p-6 text-left shadow-xs">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CalendarClock className="size-5 text-primary" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">When</p>
              <p className="text-sm font-semibold text-foreground">{displayDateLong}</p>
              <p className="text-sm font-semibold text-foreground">{displayTimeLabel}</p>
              <p className="text-xs text-muted-foreground">{PRIMARY_TIMEZONE}</p>
            </div>
          </div>
          <div className="flex gap-3 border-t border-border pt-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Video className="size-5 text-primary" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Meeting</p>
              <p className="text-sm font-semibold text-foreground">Zoom meeting</p>
              <p className="text-xs text-muted-foreground">A calendar invite and meeting link has been sent to your email.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">Payment successful</p>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd className="font-semibold text-foreground">{CHECKOUT_AMOUNT_LABEL}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Payment method</dt>
              <dd className="font-semibold text-foreground">{successPaymentLabel}</dd>
            </div>
          </dl>
        </div>
        <Button asChild className="mt-10 w-full" size="lg">
          <Link href="/account/diagnostics">Go to dashboard</Link>
        </Button>
        <Button asChild className="mt-3 w-full" variant="ghost">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  const activeSlotPhase: BookingSlotPhase =
    phase === 'date' || phase === 'details' || phase === 'payment' ? phase : 'date';
  return (
    <div className="mx-auto px-6 py-12">
      <div
        ref={bookingProgressStickySentinelRef}
        className="hidden h-px w-full shrink-0 lg:block"
        aria-hidden
      />
      <div
        className={cn(
          'mb-8 space-y-3 transition-[box-shadow,background-color,border-color] duration-200 lg:sticky lg:top-16 lg:z-40 lg:-mx-6 lg:border-b lg:px-6 lg:py-4 lg:backdrop-blur',
          isBookingProgressPinned
            ? 'lg:border-border lg:bg-background lg:shadow-md lg:supports-backdrop-filter:bg-background/92'
            : 'lg:border-transparent lg:bg-background/85 lg:supports-backdrop-filter:bg-background/70',
        )}
      >
        <BookingStepper activePhase={activeSlotPhase} />
      </div>
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mt-8">Booking</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {phase === 'date' && 'Choose Date & Time'}
          {phase === 'details' && 'Your Details'}
          {phase === 'payment' && 'Payment'}
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          {phase === 'date' &&
            `Select a slot in Philippine Time (${PRIMARY_TIMEZONE}). You can add calendar sync later — this flow captures your preference now.`}
          {phase === 'details' &&
            'We use this information only to confirm your reservation and to send your calendar invite and meeting link.'}
          {phase === 'payment' && 'Choose a payment method to secure your booking.'}
        </p>
        {phase === 'date' ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px] lg:items-start">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
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
                  className="shrink-0"
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
                        'aspect-square min-h-10 rounded-lg text-sm font-medium transition-colors',
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
                            'min-h-11 w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90'
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
                onClick={executeContinueFromDate}
              >
                Next
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link href={activeDiagnosticHref}>Back to diagnostic</Link>
              </Button>
            </aside>
          </div>
        ) : null}
        {phase === 'details' ? (
          <div className="mt-10 mx-auto w-full max-w-lg lg:max-w-3xl">
            <section
              aria-labelledby="booking-contact-heading"
              className="rounded-2xl border border-border bg-card shadow-xs ring-1 ring-border/40"
            >
              <div className="border-b border-border/80 px-6 py-6 sm:px-8 sm:py-7">
                <h2
                  id="booking-contact-heading"
                  className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                >
                  Contact information
                </h2>
                <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
                  Use the same email you check regularly — that is where we will send confirmations and updates.
                </p>
              </div>
              <div className="px-6 py-8 sm:px-8">
                <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-7">
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-full-name" className="block text-sm font-semibold leading-none text-foreground">
                      Full name <span className="font-normal text-destructive">*</span>
                    </label>
                    <Input
                      id="booking-full-name"
                      autoComplete="name"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      aria-invalid={fieldErrors.fullName !== undefined}
                      aria-describedby={fieldErrors.fullName !== undefined ? 'booking-full-name-error' : undefined}
                    />
                    {fieldErrors.fullName ? (
                      <p id="booking-full-name-error" className="flex gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{fieldErrors.fullName}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-email" className="block text-sm font-semibold leading-none text-foreground">
                      Email address <span className="font-normal text-destructive">*</span>
                    </label>
                    <Input
                      id="booking-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan.delacruz@email.com"
                      aria-invalid={fieldErrors.email !== undefined}
                      aria-describedby={fieldErrors.email !== undefined ? 'booking-email-error' : undefined}
                    />
                    {fieldErrors.email ? (
                      <p id="booking-email-error" className="flex gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{fieldErrors.email}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-company" className="block text-sm font-semibold leading-none text-foreground">
                      Company / business name{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="booking-company"
                      autoComplete="organization"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="ABC Trading"
                    />
                  </div>
                  <div className="min-w-0 space-y-2.5">
                    <label htmlFor="booking-phone" className="block text-sm font-semibold leading-none text-foreground">
                      Phone number <span className="font-normal text-destructive">*</span>
                    </label>
                    <Input
                      id="booking-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      className="h-12 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 6789"
                      aria-invalid={fieldErrors.phone !== undefined}
                      aria-describedby={fieldErrors.phone !== undefined ? 'booking-phone-error' : undefined}
                    />
                    {fieldErrors.phone ? (
                      <p id="booking-phone-error" className="flex gap-2 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{fieldErrors.phone}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-10 flex flex-col gap-3 border-t border-border/80 pt-8 sm:flex-row sm:items-stretch sm:gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 min-h-12 shrink-0 gap-2 sm:w-auto sm:px-6"
                    onClick={executeBackToDate}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="h-12 min-h-12 flex-1 text-base font-semibold sm:min-w-0"
                    size="lg"
                    onClick={executeContinueFromDetails}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
        {phase === 'payment' ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="space-y-6">
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">Payment method</legend>
                <div className="mt-4 space-y-3">
                  {PAYMENT_METHOD_OPTIONS.map((option) => {
                    const isSelected = paymentMethod === option.id;
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-colors',
                          isSelected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/30',
                        )}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={option.id}
                          checked={isSelected}
                          onChange={() => setPaymentMethod(option.id)}
                          className="size-4 accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.hint}</p>
                        </div>
                        {option.id === 'card' ? <CreditCard className="size-6 shrink-0 text-muted-foreground" aria-hidden /> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={executeBackToDetails} className="gap-2">
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </Button>
              </div>
            </div>
            <aside className="space-y-4 lg:sticky lg:top-60">
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="text-sm font-semibold text-foreground">{PROJECT_RESCUE_SERVICE_TITLE}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="mt-1 font-semibold text-foreground">{PROJECT_RESCUE_SESSION_DURATION}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Amount</dt>
                    <dd className="mt-1 font-semibold text-foreground">{CHECKOUT_AMOUNT_LABEL}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Inclusive of VAT</p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-foreground">Secure checkout</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your payment is safe and encrypted. We never store your card details on this site.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="w-full gap-2"
                size="lg"
                disabled={paymentMethod === null}
                onClick={() => void executePay()}
              >
                <Lock className="size-4" aria-hidden />
                Pay {CHECKOUT_AMOUNT_LABEL}
              </Button>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
