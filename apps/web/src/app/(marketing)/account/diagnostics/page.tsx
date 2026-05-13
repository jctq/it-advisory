import type { ReactElement } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountDiagnosticsPanel } from '@/components/marketing/account-diagnostics-panel';
import { listQuizSessionsForVisitor } from '@/lib/data/quiz-sessions';
import { buildAccountVisitorId, getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const metadata = {
  title: 'My diagnostics — IT Advisory',
};

export const dynamic = 'force-dynamic';

export default async function AccountDiagnosticsPage(): Promise<ReactElement> {
  const user = await getAuthenticatedMarketingUser();
  if (user === null) {
    redirect('/login?next=%2Faccount%2Fdiagnostics');
  }
  const visitorId = buildAccountVisitorId(user.id);
  const sessions = await listQuizSessionsForVisitor(visitorId);
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">My diagnostics</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Review past guided diagnostics, continue where you left off, delete snapshots you no longer need, or start a
            new session while keeping older results in this list.
          </p>
        </div>
        <Link href="/quiz" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Open quiz (latest)
        </Link>
      </div>
      <AccountDiagnosticsPanel initialSessions={sessions} />
    </main>
  );
}
