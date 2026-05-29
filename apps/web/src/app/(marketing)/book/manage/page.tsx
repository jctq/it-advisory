import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { GuestBookingManageFlow } from '@/components/marketing/guest-booking-manage-flow';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { readBookingSessionRoomLinksEnabled } from '@/lib/marketing/booking-session-room-gate';
import { BookRouteLoadingFallback } from '../book-route-loading-fallback';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Manage your booking · TechMD',
  description: 'Look up your booking reference to check status or complete payment.',
});

export default async function BookManagePage(): Promise<ReactNode> {
  if (!(await readManageBookingEnabled())) {
    notFound();
  }
  const bookingSessionRoomLinksEnabled = await readBookingSessionRoomLinksEnabled();
  return (
    <main className="mx-auto max-w-6xl px-0 py-0 md:px-6 md:py-12">
      <div className="mb-8 hidden md:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Booking</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Manage your booking</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Check your consultation status or pay an outstanding balance using your booking reference.
        </p>
      </div>
      <Suspense fallback={<BookRouteLoadingFallback />}>
        <GuestBookingManageFlow bookingSessionRoomLinksEnabled={bookingSessionRoomLinksEnabled} />
      </Suspense>
    </main>
  );
}
