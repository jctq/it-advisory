import { AdminSettingsForm } from '@/components/admin/admin-settings-form';

export const metadata = {
  title: 'Settings — IT Advisory Admin',
};

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminSettingsForm />
    </main>
  );
}
