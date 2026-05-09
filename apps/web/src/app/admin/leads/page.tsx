import Link from 'next/link';
import { LeadsTable } from '@/components/admin/leads-table';
import { listLeads } from '@/lib/data/leads';

export default async function AdminLeadsPage() {
  const leads = await listLeads();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">CRM</p>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
        </div>
        <Link href="/admin/bookings" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Bookings
        </Link>
      </div>
      <LeadsTable initialData={leads} />
    </main>
  );
}
