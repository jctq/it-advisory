import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { LeadsTable } from '@/components/admin/leads-table';
import { listLeads } from '@/lib/data/leads';

export default async function AdminLeadsPage() {
  const leads = await listLeads();
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader eyebrow="CRM" title="Leads" description="Latest customer leads captured from the front-facing web and native journeys." />
      <LeadsTable initialData={leads} />
    </section>
  );
}
