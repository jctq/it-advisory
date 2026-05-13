import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingsTable } from '@/components/admin/bookings-table';
import { listBookings } from '@/lib/data/bookings';

export default async function AdminBookingsPage() {
  const bookings = await listBookings();
  return (
    <section className="mx-auto space-y-8">
      <AdminPageHeader
        eyebrow="Scheduling"
        title="Bookings"
        description="All stored bookings (up to 10,000, newest slot first). Table is paginated client-side (10 per page). Quiz session links when the booking captured a session id at checkout."
      />
      <BookingsTable initialData={bookings} />
    </section>
  );
}
