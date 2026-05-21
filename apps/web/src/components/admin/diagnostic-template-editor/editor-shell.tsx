'use client';

import { useCallback, useLayoutEffect, useState, type ReactElement } from 'react';
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
  WorkspaceFullscreenProvider,
  useWorkspaceFullscreen,
  useWorkspaceFullscreenEscape,
} from '@/components/admin/diagnostic-template-editor/workspace-fullscreen-context';
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
  readonly initialEditorView?: DiagnosticTemplateEditorView;
};

type EditorShellContentProps = {
  readonly listHref: string;
  readonly initialEditorView: DiagnosticTemplateEditorView;
};

function EditorShellContent(props: EditorShellContentProps): ReactElement {
  const { template, updateTemplate, hasUnsavedChanges } = useTemplateEditor();
  const { isFullscreen, exitFullscreen } = useWorkspaceFullscreen();
  useTemplateEditorKeyboard();
  useWorkspaceFullscreenEscape();
  const [editorView, setEditorView] = useState<DiagnosticTemplateEditorView>(props.initialEditorView);
  useLayoutEffect(() => {
    const storedView = readPersistedEditorView();
    setEditorView((current) => {
      if (current === storedView) {
        return current;
      }
      writePersistedEditorView(storedView);
      return storedView;
    });
  }, []);
  const executeSetView = useCallback((view: DiagnosticTemplateEditorView): void => {
    if (view === 'classic') {
      exitFullscreen();
    }
    setEditorView(view);
    writePersistedEditorView(view);
  }, [exitFullscreen]);
  const isWorkspaceView = editorView === 'workspace';
  const toolbar = (
    <TemplateEditorToolbar
      editorView={editorView}
      listHref={props.listHref}
      onSelectView={executeSetView}
    />
  );
  const isHeaderSticky = !isWorkspaceView || (isFullscreen && isWorkspaceView);
  return (
    <div
      className={cn(
        '-mx-3 flex min-h-0 flex-col',
        isHeaderSticky ? 'gap-0' : 'gap-3',
        isWorkspaceView && !isFullscreen && 'h-[calc(100dvh-var(--admin-sticky-top,4rem)-2rem)]',
        isWorkspaceView &&
          isFullscreen &&
          'fixed inset-0 z-100 gap-0 bg-background p-3 shadow-none md:gap-0 md:p-4',
      )}
    >
      <TemplateEditorHeader
        templateName={template.name}
        hasUnsavedChanges={hasUnsavedChanges}
        actions={toolbar}
        isSticky={isHeaderSticky}
        isFullscreen={isFullscreen && isWorkspaceView}
        className="px-3"
      />
      <div
        className={cn(
          'px-3',
          isWorkspaceView ? 'flex min-h-0 flex-1 flex-col overflow-hidden pt-3' : 'min-h-0 pt-4',
          isWorkspaceView && isFullscreen && 'pt-3',
        )}
      >
        {isWorkspaceView ? (
          <div
            className={cn(
              'flex min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm',
              WORKSPACE_PANEL_CLASS,
            )}
          >
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
  const initialEditorView = props.initialEditorView ?? 'classic';
  return (
    <TemplateEditorProvider initialTemplate={props.initialTemplate}>
      <WorkspaceFullscreenProvider>
        <EditorShellContent listHref={listHref} initialEditorView={initialEditorView} />
      </WorkspaceFullscreenProvider>
    </TemplateEditorProvider>
  );
}
