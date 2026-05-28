import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SupportReportsTable } from '@/components/admin/support-reports-table';
import { listSupportReportsForAdmin } from '@/lib/data/support-reports';

export const metadata = {
  title: 'Support reports — TechMD Admin',
};

export default async function AdminSupportReportsPage() {
  const reports = await listSupportReportsForAdmin();
  return (
    <section className="mx-auto w-full space-y-8">
      <AdminPageHeader
        eyebrow="Support"
        title="Support reports"
        description="User-submitted issues from the marketing site and native app, with screenshots and reply threads."
      />
      <SupportReportsTable initialData={reports} />
    </section>
  );
}
