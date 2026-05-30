import { Suspense } from 'react';
import {
  AdminDebugWorkspace,
  type DebugTab,
} from '@/components/admin/admin-debug-workspace';

export const metadata = {
  title: 'Debug — TeqMD Admin',
};

export const dynamic = 'force-dynamic';

type AdminDebugPageProps = {
  readonly searchParams: Promise<{
    readonly tab?: string;
    readonly diagnostic?: string;
    readonly sessionId?: string;
    readonly reference?: string;
    readonly bookingReference?: string;
  }>;
};

function resolveInitialTab(tab: string | undefined): DebugTab {
  if (tab === 'cron-logs') {
    return 'cron-logs';
  }
  if (tab === 'payment-logs') {
    return 'payment-logs';
  }
  return 'client-diagnostic';
}

export default async function AdminDebugPage(props: AdminDebugPageProps): Promise<React.ReactElement> {
  const searchParams = await props.searchParams;
  const initialTab = resolveInitialTab(searchParams.tab?.trim());
  const initialDiagnostic =
    searchParams.diagnostic?.trim() ?? searchParams.sessionId?.trim() ?? '';
  const initialReference =
    searchParams.reference?.trim() ?? searchParams.bookingReference?.trim() ?? '';
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading debug tools…</p>}>
      <AdminDebugWorkspace
        initialTab={initialTab}
        initialDiagnostic={initialDiagnostic}
        initialReference={initialReference}
      />
    </Suspense>
  );
}
