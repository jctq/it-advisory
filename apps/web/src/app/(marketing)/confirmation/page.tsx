import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';
import { ConfirmationIntakePersist } from './confirmation-intake-persist';

export const metadata: Metadata = {
  title: 'Booking confirmed · IT Advisory',
  description: 'Your consultation slot is reserved.',
};

type ConfirmationPageProps = {
  readonly searchParams?: Promise<{ readonly date?: string; readonly time?: string }>;
};

function formatDisplayDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const dateRaw = resolved.date ?? '';
  const timeRaw = resolved.time ? decodeURIComponent(resolved.time) : '';
  const displayDate = dateRaw ? formatDisplayDate(dateRaw) : 'your selected date';
  const displayTime = timeRaw || 'your selected time';

  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center md:py-28">
      <ConfirmationIntakePersist date={dateRaw} time={timeRaw} />
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-9" aria-hidden />
      </div>
      <h1 className="mt-8 text-balance text-3xl font-semibold tracking-tight text-foreground">
        You&apos;re all set!
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your consultation is reserved. A calendar invite and remote meeting link can be wired when email
        delivery is connected.
      </p>
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-left shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Booking summary
        </h2>
        <dl className="mt-4 space-y-4">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">When</dt>
              <dd className="text-sm font-semibold text-foreground">
                {displayDate}
                <span className="font-normal text-muted-foreground"> · </span>
                {displayTime}
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
    </main>
  );
}
