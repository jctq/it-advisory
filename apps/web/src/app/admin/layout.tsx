import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { resolveAdminLayoutDocumentAppearance } from '@/lib/brand/resolve-root-layout-document-appearance';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const dynamic = 'force-dynamic';

export const metadata = buildNoIndexMetadata({
  title: 'TeqMD Admin',
  description: 'Internal administration for TeqMD.',
});

type AdminLayoutProps = {
  readonly children: ReactNode;
};

export default async function AdminLayout(props: AdminLayoutProps) {
  const initialAppearance = await resolveAdminLayoutDocumentAppearance();
  return <AdminShell initialAppearance={initialAppearance}>{props.children}</AdminShell>;
}
