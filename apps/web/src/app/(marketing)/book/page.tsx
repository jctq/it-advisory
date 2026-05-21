import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { BookingPicker } from './booking-picker';
import { BookRouteLoadingFallback } from './book-route-loading-fallback';
import { buildMarketingMetadata } from '@/lib/seo/site-seo';

export const metadata = buildMarketingMetadata({
  title: 'Book a session · TechMD',
  description: 'Choose a Philippine-time slot for your consultation.',
  pathname: '/book',
});

export default async function BookPage(): Promise<ReactNode> {
  const manageBookingEnabled = await readManageBookingEnabled();
  return (
    <main>
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <BookingPicker manageBookingEnabled={manageBookingEnabled} />
      </Suspense>
    </main>
  );
}
