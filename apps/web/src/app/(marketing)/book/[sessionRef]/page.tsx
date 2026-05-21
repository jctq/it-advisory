import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { BookingPicker } from '../booking-picker';
import { BookRouteLoadingFallback } from '../book-route-loading-fallback';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Book a session · TechMD',
  description: 'Choose a Philippine-time slot for your consultation.',
});

type BookSessionRefPageProps = {
  readonly params: Promise<{ readonly sessionRef: string }>;
};

export default async function BookSessionRefPage(props: BookSessionRefPageProps): Promise<ReactNode> {
  const [{ sessionRef }, manageBookingEnabled] = await Promise.all([
    props.params,
    readManageBookingEnabled(),
  ]);
  const decoded = decodeURIComponent(sessionRef.trim());
  return (
    <main>
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <BookingPicker pathSessionRef={decoded} manageBookingEnabled={manageBookingEnabled} />
      </Suspense>
    </main>
  );
}
