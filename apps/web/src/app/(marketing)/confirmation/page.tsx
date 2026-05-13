import type { Metadata } from 'next';
import { ConfirmationFlow } from './confirmation-flow';

export const metadata: Metadata = {
  title: 'Booking confirmed · IT Advisory',
  description: 'Your consultation slot is reserved.',
};

type ConfirmationPageProps = {
  readonly searchParams?: Promise<{ readonly date?: string; readonly time?: string; readonly sessionId?: string }>;
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
  const sessionIdRaw = resolved.sessionId?.trim() ?? '';
  const displayDate = dateRaw ? formatDisplayDate(dateRaw) : 'your selected date';
  const displayTime = timeRaw || 'your selected time';
  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center md:py-28">
      <ConfirmationFlow
        dateRaw={dateRaw}
        timeRaw={timeRaw}
        displayDate={displayDate}
        displayTime={displayTime}
        quizSessionIdRaw={sessionIdRaw.length > 0 ? sessionIdRaw : undefined}
      />
    </main>
  );
}
