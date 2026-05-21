import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

type AdminLayoutProps = {
  readonly children: ReactNode;
};

export default function AdminLayout(props: AdminLayoutProps) {
  return <AdminShell>{props.children}</AdminShell>;
}
