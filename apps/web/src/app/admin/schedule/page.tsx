import { Suspense } from 'react';
import { AdminAdvisorSchedulePageContent } from '@/components/admin/admin-advisor-schedule-manager';
import { resolveScheduleTab } from '@/lib/admin/admin-schedule-tabs';

export const metadata = {
  title: 'Schedule — TeqMD Admin',
};

type AdminSchedulePageProps = {
  readonly searchParams: Promise<{
    readonly tab?: string;
  }>;
};

export default async function AdminSchedulePage(props: AdminSchedulePageProps): Promise<React.ReactElement> {
  const searchParams = await props.searchParams;
  const initialTab = resolveScheduleTab(searchParams.tab?.trim());
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading schedule…</p>}>
      <AdminAdvisorSchedulePageContent initialTab={initialTab} />
    </Suspense>
  );
}
