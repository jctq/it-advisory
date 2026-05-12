import { notFound } from 'next/navigation';
import { DiagnosticTemplatesManager } from '@/components/admin/diagnostic-templates-manager';
import { getDiagnosticTemplateById } from '@/lib/data/diagnostic-templates';

type AdminDiagnosticTemplateDetailPageProps = {
  readonly params: Promise<{
    templateId: string;
  }>;
};

export const metadata = {
  title: 'Edit Diagnostic Template — IT Advisory Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminDiagnosticTemplateDetailPage(
  props: AdminDiagnosticTemplateDetailPageProps,
) {
  const { templateId } = await props.params;
  const template = await getDiagnosticTemplateById(templateId);
  if (template === null) {
    notFound();
  }
  return (
    <DiagnosticTemplatesManager
      initialTemplates={[template]}
      displayMode="editor"
      listHref="/admin/diagnostic-templates"
    />
  );
}
