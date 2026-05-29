import { AdminBookingsWorkspace } from '@/components/admin/admin-bookings-workspace';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { resolveBookingsViewMode } from '@/lib/admin/admin-bookings-view';

export const metadata = {
  title: 'Bookings — TechMD Admin',
};

type AdminBookingsPageProps = {
  readonly searchParams: Promise<{
    readonly view?: string;
  }>;
};

export default async function AdminBookingsPage(props: AdminBookingsPageProps): Promise<React.ReactElement> {
  const searchParams = await props.searchParams;
  const initialViewMode = resolveBookingsViewMode(searchParams.view?.trim());
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Scheduling"
        title="Bookings"
        description="Calendar loads bookings from the API for the visible date range (default: today, Asia/Manila). Filter by status in the sidebar, set a custom from/to range, or search by reference. Hover an event for contact preview; use Month, Week, Day, or List in the toolbar. Click an event for full details."
      />
      <AdminBookingsWorkspace initialViewMode={initialViewMode} />
    </section>
  );
}
