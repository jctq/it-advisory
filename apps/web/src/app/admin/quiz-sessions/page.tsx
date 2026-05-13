import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { QuizSessionsTable } from '@/components/admin/quiz-sessions-table';
import { listQuizSessionsForAdmin } from '@/lib/data/quiz-sessions';

export const metadata = {
  title: 'Quiz sessions — IT Advisory Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminQuizSessionsPage() {
  const sessions = await listQuizSessionsForAdmin();
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        eyebrow="Intake"
        title="Quiz sessions"
        description="Latest persisted guided diagnostic state per visitor cookie (quiz_sessions). Each save overwrites the visitor’s current row; use Save history on a session for append-only audit rows."
      />
      <QuizSessionsTable initialData={sessions} />
    </section>
  );
}
