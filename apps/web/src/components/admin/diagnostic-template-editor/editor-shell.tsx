'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { DiagnosticTemplatesManager } from '@/components/admin/diagnostic-templates-manager';
import { TemplateWorkspace } from '@/components/admin/diagnostic-template-editor/template-workspace';
import {
  TemplateEditorProvider,
  useTemplateEditor,
} from '@/components/admin/diagnostic-template-editor/template-editor-context';
import { TemplateEditorHeader } from '@/components/admin/diagnostic-template-editor/template-editor-header';
import { TemplateEditorToolbar } from '@/components/admin/diagnostic-template-editor/template-editor-toolbar';
import { useTemplateEditorKeyboard } from '@/components/admin/diagnostic-template-editor/use-template-editor-keyboard';
import {
  readPersistedEditorView,
  writePersistedEditorView,
  type DiagnosticTemplateEditorView,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { WORKSPACE_PANEL_CLASS } from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type DiagnosticTemplateEditorShellProps = {
  readonly initialTemplate: DiagnosticTemplateValue;
  readonly listHref?: string;
};

function EditorShellContent(props: { readonly listHref: string }): ReactElement {
  const { template, updateTemplate, hasUnsavedChanges } = useTemplateEditor();
  useTemplateEditorKeyboard();
  const [editorView, setEditorView] = useState<DiagnosticTemplateEditorView>('classic');
  useEffect(() => {
    setEditorView(readPersistedEditorView());
  }, []);
  const executeSetView = useCallback((view: DiagnosticTemplateEditorView): void => {
    setEditorView(view);
    writePersistedEditorView(view);
  }, []);
  const isWorkspaceView = editorView === 'workspace';
  const toolbar = (
    <TemplateEditorToolbar
      editorView={editorView}
      listHref={props.listHref}
      onSelectView={executeSetView}
    />
  );
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-3',
        isWorkspaceView && 'h-[calc(100dvh-5.5rem)]',
      )}
    >
      <TemplateEditorHeader
        templateName={template.name}
        hasUnsavedChanges={hasUnsavedChanges}
        actions={toolbar}
      />
      <div className={cn(isWorkspaceView ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0')}>
        {isWorkspaceView ? (
          <div className={cn('flex min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm', WORKSPACE_PANEL_CLASS)}>
            <TemplateWorkspace />
          </div>
        ) : (
          <DiagnosticTemplatesManager
            initialTemplates={[template]}
            displayMode="editor"
            listHref={props.listHref}
            controlledTemplate={template}
            onControlledTemplateChange={(nextTemplate) => updateTemplate(() => nextTemplate)}
            hideEditorChrome
          />
        )}
      </div>
    </div>
  );
}

export function DiagnosticTemplateEditorShell(props: DiagnosticTemplateEditorShellProps): ReactElement {
  const listHref = props.listHref ?? '/admin/diagnostic-templates';
  return (
    <TemplateEditorProvider initialTemplate={props.initialTemplate}>
      <EditorShellContent listHref={listHref} />
    </TemplateEditorProvider>
  );
}
