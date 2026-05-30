import type { ReactElement } from 'react';
import { notFound, redirect } from 'next/navigation';
import { AccountReportDetail } from '@/components/marketing/account-report-detail';
import { computeSupportReportReporterReplyPolicy } from '@/lib/data/support-report-reporter-reply-policy';
import {
  findSupportReportByIdForReporter,
  markSupportReportReadByReporter,
} from '@/lib/data/support-reports';
import { getSupportSettings } from '@/lib/data/support-settings';
import { readSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const dynamic = 'force-dynamic';

type AccountReportDetailPageProps = {
  readonly params: Promise<{ readonly reportId: string }>;
};

export async function generateMetadata(props: AccountReportDetailPageProps) {
  const { reportId } = await props.params;
  return buildNoIndexMetadata({
    title: `Report ${reportId} — TeqMD`,
    description: 'View your support report and replies.',
  });
}

export default async function AccountReportDetailPage(props: AccountReportDetailPageProps): Promise<ReactElement> {
  if (!(await readSupportModuleEnabled())) {
    notFound();
  }
  const user = await getAuthenticatedMarketingUser();
  if (user === null) {
    redirect('/login?next=%2Faccount%2Freports');
  }
  const { reportId } = await props.params;
  const report = await findSupportReportByIdForReporter({
    reportId,
    userId: user.id,
    email: user.email,
  });
  if (report === null) {
    notFound();
  }
  await markSupportReportReadByReporter({
    reportId,
    userId: user.id,
    email: user.email,
  });
  const settings = await getSupportSettings();
  const replyPolicy = computeSupportReportReporterReplyPolicy(report, settings);
  return (
    <main className="mx-auto max-w-6xl px-0 py-0 md:px-6 md:py-12">
      <div className="mb-6 hidden md:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Report conversation</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your message and replies from our support team in one thread.
        </p>
      </div>
      <AccountReportDetail initialReplyPolicy={replyPolicy} report={report} />
    </main>
  );
}
