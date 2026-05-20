import type { ReactElement } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountDiagnosticsPanel } from '@/components/marketing/account-diagnostics-panel';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const metadata = {
  title: 'My diagnostics — TechMD',
};

export const dynamic = 'force-dynamic';

export default async function AccountDiagnosticsPage(): Promise<ReactElement> {
  const [user, manageBookingEnabled] = await Promise.all([
    getAuthenticatedMarketingUser(),
    readManageBookingEnabled(),
  ]);
  if (user === null) {
    redirect('/login?next=%2Faccount%2Fdiagnostics');
  }
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">My diagnostics</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track guided diagnostics, find bookings by reference, and pick up where you left off.
          </p>
        </div>
      </div>
      <AccountDiagnosticsPanel manageBookingEnabled={manageBookingEnabled} />
    </main>
  );
}
