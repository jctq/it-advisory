import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { readBookingSessionRoomLinksEnabled } from '@/lib/marketing/booking-session-room-gate';
import { BookingPicker } from './booking-picker';
import { BookRouteLoadingFallback } from './book-route-loading-fallback';
import { buildPageMetadata } from '@/lib/seo/site-seo';

export async function generateMetadata() {
  return buildPageMetadata('book', { pathname: '/book' });
}

export default async function BookPage(): Promise<ReactNode> {
  const [manageBookingEnabled, bookingSessionRoomLinksEnabled] = await Promise.all([
    readManageBookingEnabled(),
    readBookingSessionRoomLinksEnabled(),
  ]);
  return (
    <main>
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <BookingPicker
          manageBookingEnabled={manageBookingEnabled}
          bookingSessionRoomLinksEnabled={bookingSessionRoomLinksEnabled}
        />
      </Suspense>
    </main>
  );
}
