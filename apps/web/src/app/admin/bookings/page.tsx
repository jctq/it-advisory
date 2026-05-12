import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingsTable } from '@/components/admin/bookings-table';
import { listBookings } from '@/lib/data/bookings';

export default async function AdminBookingsPage() {
  const bookings = await listBookings();
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader eyebrow="Scheduling" title="Bookings" description="Scheduled customer sessions across the front-facing web and native intake funnels." />
      <BookingsTable initialData={bookings} />
    </section>
  );
}
