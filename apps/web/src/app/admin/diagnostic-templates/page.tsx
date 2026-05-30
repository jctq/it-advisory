import { DiagnosticTemplatesList } from '@/components/admin/diagnostic-templates-list';
import { listDiagnosticTemplates } from '@/lib/data/diagnostic-templates';

export const metadata = {
  title: 'Diagnostic Templates — TeqMD Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminDiagnosticTemplatesPage() {
  const templates = await listDiagnosticTemplates();
  return <DiagnosticTemplatesList initialTemplates={templates} />;
}
