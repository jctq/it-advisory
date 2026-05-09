import Link from 'next/link';
import { BookingsTable } from '@/components/admin/bookings-table';
import { listBookings } from '@/lib/data/bookings';

export default async function AdminBookingsPage() {
  const bookings = await listBookings();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Scheduling</p>
          <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
        </div>
        <Link href="/admin/leads" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Leads
        </Link>
      </div>
      <BookingsTable initialData={bookings} />
    </main>
  );
}
