import { AdminBookingsWorkspace } from '@/components/admin/admin-bookings-workspace';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { listBookingsForAdminCalendar } from '@/lib/data/bookings';

export default async function AdminBookingsPage() {
  const bookings = await listBookingsForAdminCalendar();
  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Scheduling"
        title="Bookings"
        description="Calendar of stored bookings (up to 10,000). Filter by status in the sidebar, hover an event for contact preview, then use Month, Week, Day, or List in the toolbar; times are Asia/Manila. Click an event for full details. Rows cannot be deleted from this app."
      />
      <AdminBookingsWorkspace bookings={bookings} />
    </section>
  );
}
