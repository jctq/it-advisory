'use client';

import { Redo2, Undo2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTemplateEditor } from '@/components/admin/diagnostic-template-editor/template-editor-context';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type TemplateEditorUndoControlsProps = {
  readonly className?: string;
  readonly size?: 'sm' | 'default';
  /** When false, parent must wrap with TooltipProvider (e.g. TemplateEditorToolbar). */
  readonly withTooltipProvider?: boolean;
};

export function TemplateEditorUndoControls(props: TemplateEditorUndoControlsProps): ReactElement {
  const { canUndo, canRedo, executeUndo, executeRedo } = useTemplateEditor();
  const buttonClass = cn('gap-1.5 disabled:opacity-40', WORKSPACE_CHROME_BUTTON_CLASS);
  const controls = (
    <div
      className={cn('inline-flex gap-0.5 rounded-lg border p-0.5', WORKSPACE_CHROME_SHELL_CLASS, props.className)}
      role="group"
      aria-label="History"
    >
      <WorkspaceTooltip label="Undo (⌘Z)" tone="workspace">
        <Button
          type="button"
          size={props.size ?? 'sm'}
          variant="ghost"
          aria-label="Undo"
          disabled={!canUndo}
          className={buttonClass}
          onClick={executeUndo}
        >
          <Undo2 className="size-3.5 shrink-0" aria-hidden />
          Undo
        </Button>
      </WorkspaceTooltip>
      <WorkspaceTooltip label="Redo (⌘⇧Z)" tone="workspace">
        <Button
          type="button"
          size={props.size ?? 'sm'}
          variant="ghost"
          aria-label="Redo"
          disabled={!canRedo}
          className={buttonClass}
          onClick={executeRedo}
        >
          <Redo2 className="size-3.5 shrink-0" aria-hidden />
          Redo
        </Button>
      </WorkspaceTooltip>
    </div>
  );
  if (props.withTooltipProvider === false) {
    return controls;
  }
  return <TooltipProvider delayDuration={300}>{controls}</TooltipProvider>;
}
