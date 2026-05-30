import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { AccountDiagnosticsPanel } from '@/components/marketing/account-diagnostics-panel';
import { listQuizSessionsForVisitorPaginated } from '@/lib/data/quiz-sessions';
import {
  buildDefaultAccountDiagnosticsListRequest,
  type AccountDiagnosticsInitialList,
} from '@/lib/marketing/account-diagnostics-list';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { scheduleVisitorPaymentReconciliationIfNeeded } from '@/lib/payments/reconcile-visitor-payments';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'My diagnostics — TeqMD',
  description: 'View your saved TeqMD diagnostic sessions.',
});

export const dynamic = 'force-dynamic';

export default async function AccountDiagnosticsPage(): Promise<ReactElement> {
  const [user, manageBookingEnabled] = await Promise.all([
    getAuthenticatedMarketingUser(),
    readManageBookingEnabled(),
  ]);
  if (user === null) {
    redirect('/login?next=%2Faccount%2Fdiagnostics');
  }
  const defaultListRequest = buildDefaultAccountDiagnosticsListRequest();
  const initialListResult = await listQuizSessionsForVisitorPaginated({
    visitorId: buildAccountVisitorId(user.id),
    ...defaultListRequest,
  });
  const initialList: AccountDiagnosticsInitialList = {
    ...defaultListRequest,
    result: initialListResult,
  };
  scheduleVisitorPaymentReconciliationIfNeeded(buildAccountVisitorId(user.id));
  return (
    <main className="mx-auto max-w-6xl px-0 py-0 md:px-6 md:py-12">
      <div className="mb-8 hidden flex-wrap items-start justify-between gap-4 md:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">My diagnostics</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track guided diagnostics, find bookings by reference, and pick up where you left off.
          </p>
        </div>
      </div>
      <AccountDiagnosticsPanel manageBookingEnabled={manageBookingEnabled} initialList={initialList} />
    </main>
  );
}
