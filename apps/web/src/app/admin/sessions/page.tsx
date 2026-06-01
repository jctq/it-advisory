import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DiagnosticSessionsTable } from '@/components/admin/diagnostic-sessions-table';
import { listDiagnosticSessionsForAdmin } from '@/lib/data/diagnostic-sessions';

export const metadata = {
  title: 'Sessions — TeqMD Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminDiagnosticSessionsPage() {
  const sessions = await listDiagnosticSessionsForAdmin();
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Intake"
        title="Sessions"
        description="Latest persisted guided diagnostic per visitor. Booked = a web booking stored this session id when the slot was reserved. Each save overwrites the visitor row; open a session for Save history (audit)."
      />
      <DiagnosticSessionsTable initialData={sessions} />
    </section>
  );
}
