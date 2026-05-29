import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BookingSessionRoomFlow } from '@/components/marketing/booking-session-room-flow';
import { readBookingSessionRoomLinksEnabled } from '@/lib/marketing/booking-session-room-gate';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';
import { BookRouteLoadingFallback } from '../book-route-loading-fallback';

export const metadata = buildNoIndexMetadata({
  title: 'Session room · TechMD',
  description: 'Join your TechMD consultation from your branded session room.',
});

export default async function BookSessionRoomPage(): Promise<ReactNode> {
  const bookingSessionRoomLinksEnabled = await readBookingSessionRoomLinksEnabled();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <BookingSessionRoomFlow bookingSessionRoomLinksEnabled={bookingSessionRoomLinksEnabled} />
      </Suspense>
    </main>
  );
}
