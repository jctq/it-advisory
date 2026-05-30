import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdvisorChat } from '@/components/admin/advisor-chat';

export const metadata = {
  title: 'Advisor — TeqMD Admin',
};

export default function AdminAdvisorPage() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6">
      <AdminPageHeader
        eyebrow="Internal"
        title="Strategic advisor"
        description="Founder-facing chat to challenge product, technical, and business decisions. Separate from the customer diagnostic intake."
      />
      <AdvisorChat />
    </section>
  );
}
