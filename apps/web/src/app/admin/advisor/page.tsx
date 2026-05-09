import Link from 'next/link';
import { AdvisorChat } from '@/components/admin/advisor-chat';

export const metadata = {
  title: 'Advisor — IT Advisory Admin',
};

export default function AdminAdvisorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Internal</p>
          <h1 className="text-3xl font-semibold tracking-tight">Strategic advisor</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Founder-facing chat to challenge product, technical, and business decisions. Separate
            from the customer diagnostic intake. Free-form prose, no caching.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-primary">
          <Link href="/admin/leads" className="underline-offset-4 hover:underline">
            Leads
          </Link>
          <Link href="/admin/bookings" className="underline-offset-4 hover:underline">
            Bookings
          </Link>
          <Link href="/admin/settings" className="underline-offset-4 hover:underline">
            Settings
          </Link>
        </nav>
      </header>
      <AdvisorChat />
    </main>
  );
}
