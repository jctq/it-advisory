import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { QuizSessionsTable } from '@/components/admin/quiz-sessions-table';
import { listQuizSessionsForAdmin } from '@/lib/data/quiz-sessions';

export const metadata = {
  title: 'Sessions — TechMD Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminQuizSessionsPage() {
  const sessions = await listQuizSessionsForAdmin();
  return (
    <section className="mx-auto space-y-8">
      <AdminPageHeader
        eyebrow="Intake"
        title="Sessions"
        description="Latest persisted guided diagnostic per visitor. Booked = a web booking stored this session id when the slot was reserved. Each save overwrites the visitor row; open a session for Save history (audit)."
      />
      <QuizSessionsTable initialData={sessions} />
    </section>
  );
}
