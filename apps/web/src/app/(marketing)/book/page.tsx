import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BookingPicker } from './booking-picker';

export const metadata: Metadata = {
  title: 'Book a session · IT Advisory',
  description: 'Choose a Philippine-time slot for your consultation.',
};

function BookingPickerFallback(): ReactNode {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="h-8 max-w-sm animate-pulse rounded-md bg-muted" aria-hidden />
      <div className="mt-4 h-4 max-w-lg animate-pulse rounded-md bg-muted/70" aria-hidden />
      <p className="sr-only">Loading booking calendar</p>
    </div>
  );
}

export default function BookPage(): ReactNode {
  return (
    <main>
      <Suspense fallback={<BookingPickerFallback />}>
        <BookingPicker />
      </Suspense>
    </main>
  );
}
