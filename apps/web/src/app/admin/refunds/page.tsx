import type { ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRefundsWorkspace } from '@/components/admin/admin-refunds-workspace';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Refunds — TeqMD Admin',
};

export default function AdminRefundsPage(): ReactElement {
  return (
    <section className="mx-auto w-full space-y-8">
      <AdminPageHeader
        eyebrow="Bookings"
        title="Refunds"
        description="Customer cancellation requests awaiting manual refund processing. Filter by status, then mark each refund complete after sending funds through your payment gateway."
      />
      <AdminRefundsWorkspace />
    </section>
  );
}
