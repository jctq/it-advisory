import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { getAdminDashboardData } from '@/lib/data/admin-dashboard';

export const metadata = {
  title: 'Dashboard — IT Advisory Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminIndexPage() {
  const data = await getAdminDashboardData();
  return <AdminDashboard data={data} />;
}
