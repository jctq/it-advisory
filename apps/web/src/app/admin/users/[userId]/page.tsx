import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { findMarketingUserDetailForAdmin } from '@/lib/data/marketing-users-admin';

type AdminMarketingUserDetailPageProps = {
  readonly params: Promise<{ readonly userId: string }>;
};

export const metadata = {
  title: 'User — TechMD Admin',
};

export const dynamic = 'force-dynamic';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

export default async function AdminMarketingUserDetailPage(props: AdminMarketingUserDetailPageProps) {
  const { userId } = await props.params;
  const detail = await findMarketingUserDetailForAdmin(userId);
  if (detail === null) {
    notFound();
  }
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Accounts"
        title="Marketing user"
        description="Account metadata, active browser sessions (user_auth_sessions), and quiz snapshots stored under this account visitor id."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/users" className="font-medium text-primary underline-offset-4 hover:underline">
          ← All users
        </Link>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User id</dt>
            <dd className="mt-1 font-mono text-sm text-foreground">{detail.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-1 text-sm text-foreground">{detail.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz visitor id</dt>
            <dd className="mt-1 font-mono text-xs break-all text-foreground">{detail.accountVisitorId}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registered</dt>
            <dd className="mt-1 text-sm text-foreground">{DATE_TIME_FORMATTER.format(new Date(detail.createdAtIso))}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile updated</dt>
            <dd className="mt-1 text-sm text-foreground">{DATE_TIME_FORMATTER.format(new Date(detail.updatedAtIso))}</dd>
          </div>
        </dl>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Sign-in sessions</h2>
        <p className="text-sm text-muted-foreground">
          Rows in <span className="font-mono text-xs">user_auth_sessions</span>. Expired rows may remain until TTL cleanup
          is configured.
        </p>
        {detail.authSessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            No sessions recorded (user has not signed in since collection was added, or sessions were removed).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-medium text-foreground">Session id</th>
                  <th className="px-4 py-3 font-medium text-foreground">Created (PH)</th>
                  <th className="px-4 py-3 font-medium text-foreground">Expires (PH)</th>
                  <th className="px-4 py-3 font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.authSessions.map((row) => (
                  <tr key={row.id} className="border-b border-border/80 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{DATE_TIME_FORMATTER.format(new Date(row.createdAtIso))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{DATE_TIME_FORMATTER.format(new Date(row.expiresAtIso))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.isExpired
                            ? 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                            : 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200'
                        }
                      >
                        {row.isExpired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Quiz snapshots (this account)</h2>
        <p className="text-sm text-muted-foreground">
          Latest rows in <span className="font-mono text-xs">quiz_sessions</span> for visitor id{' '}
          <span className="font-mono text-xs">{detail.accountVisitorId}</span>.
        </p>
        {detail.quizSnapshots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            No quiz rows for this account yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-medium text-foreground">Session</th>
                  <th className="px-4 py-3 font-medium text-foreground">Step</th>
                  <th className="px-4 py-3 font-medium text-foreground">Updated (PH)</th>
                  <th className="px-4 py-3 font-medium text-foreground">Completed</th>
                  <th className="px-4 py-3 font-medium text-foreground"> </th>
                </tr>
              </thead>
              <tbody>
                {detail.quizSnapshots.map((row) => (
                  <tr key={row.id} className="border-b border-border/80 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.currentStep}</td>
                    <td className="px-4 py-3 text-muted-foreground">{DATE_TIME_FORMATTER.format(new Date(row.updatedAtIso))}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.completedAtIso !== null ? DATE_TIME_FORMATTER.format(new Date(row.completedAtIso)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/sessions/${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
