import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DiagnosticTemplateEditorShell } from '@/components/admin/diagnostic-template-editor/editor-shell';
import {
  EDITOR_VIEW_STORAGE_KEY,
  readEditorViewFromCookieValue,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import { getDiagnosticTemplateById } from '@/lib/data/diagnostic-templates';

type AdminDiagnosticTemplateDetailPageProps = {
  readonly params: Promise<{
    templateId: string;
  }>;
};

export const metadata = {
  title: 'Edit Diagnostic Template — TeqMD Admin',
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
  const cookieStore = await cookies();
  const initialEditorView = readEditorViewFromCookieValue(
    cookieStore.get(EDITOR_VIEW_STORAGE_KEY)?.value,
  );
  return (
    <DiagnosticTemplateEditorShell
      initialTemplate={template}
      listHref="/admin/diagnostic-templates"
      initialEditorView={initialEditorView}
    />
  );
}
