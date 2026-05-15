import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BookingPicker } from './booking-picker';
import { BookRouteLoadingFallback } from './book-route-loading-fallback';

export const metadata: Metadata = {
  title: 'Book a session · TechMD',
  description: 'Choose a Philippine-time slot for your consultation.',
};

export default function BookPage(): ReactNode {
  return (
    <main>
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <BookingPicker />
      </Suspense>
    </main>
  );
}
