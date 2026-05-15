import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { MarketingUsersTable } from '@/components/admin/marketing-users-table';
import { listMarketingUsersForAdmin } from '@/lib/data/marketing-users-admin';

export const metadata = {
  title: 'Users — TechMD Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminMarketingUsersPage() {
  const users = await listMarketingUsersForAdmin();
  return (
    <section className="mx-auto space-y-8">
      <AdminPageHeader
        eyebrow="Accounts"
        title="Marketing users"
        description="Optional web sign-ups (MongoDB users collection). Diagnostics still work anonymously; signed-in visitors use visitor id acct: plus the Mongo user id for quiz and booking rows. Open a user for sign-in sessions and linked quiz snapshots."
      />
      <MarketingUsersTable initialData={users} />
    </section>
  );
}
