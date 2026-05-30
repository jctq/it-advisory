import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const dynamic = 'force-dynamic';

export const metadata = buildNoIndexMetadata({
  title: 'TeqMD Admin',
  description: 'Internal administration for TeqMD.',
});

type AdminLayoutProps = {
  readonly children: ReactNode;
};

export default function AdminLayout(props: AdminLayoutProps) {
  return <AdminShell>{props.children}</AdminShell>;
}
