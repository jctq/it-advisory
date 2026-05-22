import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { LeadsTable } from '@/components/admin/leads-table';
import { listLeads } from '@/lib/data/leads';

export default async function AdminLeadsPage() {
  const leads = await listLeads();
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader eyebrow="CRM" title="Leads" description="Latest customer leads captured from the front-facing web and native journeys." />
      <LeadsTable initialData={leads} />
    </section>
  );
}
