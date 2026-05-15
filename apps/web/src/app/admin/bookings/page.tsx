import { AdminBookingsCalendar } from '@/components/admin/admin-bookings-calendar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { listBookings } from '@/lib/data/bookings';

export default async function AdminBookingsPage() {
  const bookings = await listBookings();
  return (
    <section className="mx-auto space-y-8">
      <AdminPageHeader
        eyebrow="Scheduling"
        title="Bookings"
        description="Calendar of stored bookings (up to 10,000). Use Month, Week, Day, or List in the toolbar; times are Asia/Manila. Click an event for details. Rows cannot be deleted from this app."
      />
      <AdminBookingsCalendar bookings={bookings} />
    </section>
  );
}
