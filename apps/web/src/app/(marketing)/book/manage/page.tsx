import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { GuestBookingManageFlow } from '@/components/marketing/guest-booking-manage-flow';
import { BookRouteLoadingFallback } from '../book-route-loading-fallback';

export const metadata: Metadata = {
  title: 'Manage your booking · TechMD',
  description: 'Look up your booking reference to check status or complete payment.',
};

export default function BookManagePage(): ReactNode {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Booking</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Manage your booking</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Check your consultation status or pay an outstanding balance using your booking reference.
        </p>
      </div>
      <div className="mt-10">
        <Suspense fallback={<BookRouteLoadingFallback />}>
          <GuestBookingManageFlow />
        </Suspense>
      </div>
    </main>
  );
}
