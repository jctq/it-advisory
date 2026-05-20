import { notFound } from 'next/navigation';
import { DiagnosticTemplateEditorShell } from '@/components/admin/diagnostic-template-editor/editor-shell';
import { getDiagnosticTemplateById } from '@/lib/data/diagnostic-templates';

type AdminDiagnosticTemplateDetailPageProps = {
  readonly params: Promise<{
    templateId: string;
  }>;
};

export const metadata = {
  title: 'Edit Diagnostic Template — TechMD Admin',
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
    <DiagnosticTemplateEditorShell
      initialTemplate={template}
      listHref="/admin/diagnostic-templates"
    />
  );
}
