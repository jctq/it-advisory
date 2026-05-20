'use client';

import { LayoutGrid, List, Save } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { TemplateEditorUndoControls } from '@/components/admin/diagnostic-template-editor/template-editor-undo-controls';
import { useTemplateEditor } from '@/components/admin/diagnostic-template-editor/template-editor-context';
import type { DiagnosticTemplateEditorView } from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type TemplateEditorToolbarProps = {
  readonly editorView: DiagnosticTemplateEditorView;
  readonly listHref: string;
  readonly onSelectView: (view: DiagnosticTemplateEditorView) => void;
};

const VIEW_OPTIONS: readonly {
  readonly id: DiagnosticTemplateEditorView;
  readonly label: string;
  readonly icon: LucideIcon;
}[] = [
  { id: 'classic', label: 'Classic', icon: List },
  { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
];

const TOOLBAR_GROUP_SHELL = 'inline-flex gap-0.5 rounded-lg border p-0.5';

export function TemplateEditorToolbar(props: TemplateEditorToolbarProps): ReactElement {
  const { hasUnsavedChanges, isSaving, executeSave } = useTemplateEditor();
  const saveLabel = isSaving ? 'Saving…' : 'Save';
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Template editor actions">
        <TemplateEditorUndoControls withTooltipProvider={false} />
        <div className={cn(TOOLBAR_GROUP_SHELL, WORKSPACE_CHROME_SHELL_CLASS)} role="group" aria-label="Editor view">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = props.editorView === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={isActive ? 'default' : 'ghost'}
                aria-pressed={isActive}
                className={cn('gap-1.5', !isActive && WORKSPACE_CHROME_BUTTON_CLASS)}
                onClick={() => props.onSelectView(option.id)}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void executeSave()}
          disabled={isSaving || !hasUnsavedChanges}
          className="gap-1.5 shadow-xs"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saveLabel}
        </Button>
        <Button asChild type="button" variant="outline" size="sm" className={WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS}>
          <Link href={props.listHref}>Back</Link>
        </Button>
      </div>
    </TooltipProvider>
  );
}
