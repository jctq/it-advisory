import { Suspense } from 'react';
import { AdminSettingsWorkspace } from '@/components/admin/admin-settings-workspace';
import { resolveSettingsTab } from '@/lib/admin/admin-settings-tabs';

export const metadata = {
  title: 'Settings — TechMD Admin',
};

type AdminSettingsPageProps = {
  readonly searchParams: Promise<{
    readonly tab?: string;
  }>;
};

export default async function AdminSettingsPage(props: AdminSettingsPageProps): Promise<React.ReactElement> {
  const searchParams = await props.searchParams;
  const initialTab = resolveSettingsTab(searchParams.tab?.trim());
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <AdminSettingsWorkspace initialTab={initialTab} />
    </Suspense>
  );
}
