import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminSettingsForm } from '@/components/admin/admin-settings-form';

export const metadata = {
  title: 'Settings — IT Advisory Admin',
};

export default function AdminSettingsPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Control how customer-facing diagnostic intake behaves across the web and native front-facing experiences."
      />
      <AdminSettingsForm />
    </section>
  );
}
