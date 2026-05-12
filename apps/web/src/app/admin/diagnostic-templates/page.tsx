import { DiagnosticTemplatesManager } from '@/components/admin/diagnostic-templates-manager';
import { listDiagnosticTemplates } from '@/lib/data/diagnostic-templates';

export const metadata = {
  title: 'Diagnostic Templates — IT Advisory Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminDiagnosticTemplatesPage() {
  const templates = await listDiagnosticTemplates();
  return <DiagnosticTemplatesManager initialTemplates={templates} />;
}
