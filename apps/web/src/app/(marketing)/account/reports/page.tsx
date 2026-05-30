import type { ReactElement } from 'react';
import { notFound, redirect } from 'next/navigation';
import { AccountReportsPanel } from '@/components/marketing/account-reports-panel';
import { buildDefaultAccountReportsListRequest } from '@/lib/marketing/account-reports-list';
import { readSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { listSupportReportsForReporter } from '@/lib/data/support-reports';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'My reports — TeqMD',
  description: 'View your submitted TeqMD support reports and team replies.',
});

export const dynamic = 'force-dynamic';

export default async function AccountReportsPage(): Promise<ReactElement> {
  if (!(await readSupportModuleEnabled())) {
    notFound();
  }
  const user = await getAuthenticatedMarketingUser();
  if (user === null) {
    redirect('/login?next=%2Faccount%2Freports');
  }
  const defaultListRequest = buildDefaultAccountReportsListRequest();
  const initialPage = await listSupportReportsForReporter({
    userId: user.id,
    email: user.email,
    page: defaultListRequest.page,
    pageSize: defaultListRequest.pageSize,
    search: defaultListRequest.search,
    status: defaultListRequest.status,
  });
  return (
    <main className="mx-auto max-w-6xl px-0 py-0 md:px-6 md:py-12">
      <div className="mb-8 hidden flex-wrap items-start justify-between gap-4 md:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">My reports</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Issues you reported from the site or app. Search your threads and read replies from our team.
          </p>
        </div>
      </div>
      <AccountReportsPanel initialList={{ ...defaultListRequest, result: initialPage }} />
    </main>
  );
}
