import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BookingPicker } from '../booking-picker';
import { BookRouteLoadingFallback } from '../book-route-loading-fallback';

export const metadata: Metadata = {
  title: 'Book a session · IT Advisory',
  description: 'Choose a Philippine-time slot for your consultation.',
};

type BookSessionRefPageProps = {
  readonly params: Promise<{ readonly sessionRef: string }>;
};

export default async function BookSessionRefPage(props: BookSessionRefPageProps): Promise<ReactNode> {
  const { sessionRef } = await props.params;
  const decoded = decodeURIComponent(sessionRef.trim());
  return (
    <main>
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <BookingPicker pathSessionRef={decoded} />
      </Suspense>
    </main>
  );
}
