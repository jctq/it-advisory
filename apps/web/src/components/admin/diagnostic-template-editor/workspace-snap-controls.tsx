'use client';

import { Grid3x3, Magnet } from 'lucide-react';
import type { ReactElement } from 'react';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { Button } from '@/components/ui/button';
import {
  WORKSPACE_CHROME_ACTIVE_SKY_CLASS,
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type WorkspaceSnapControlsProps = {
  readonly isGridSnapEnabled: boolean;
  readonly isAlignmentSnapEnabled: boolean;
  readonly onToggleGridSnap: () => void;
  readonly onToggleAlignmentSnap: () => void;
  readonly compact?: boolean;
};

export function WorkspaceSnapControls(props: WorkspaceSnapControlsProps): ReactElement {
  const isCompact = props.compact === true;
  const shellClass = isCompact ? 'flex items-center gap-0' : cn('flex gap-1 rounded-xl p-1', WORKSPACE_CHROME_SHELL_CLASS);
  const buttonClass = cn(WORKSPACE_CHROME_BUTTON_CLASS, isCompact ? 'size-7 shrink-0' : 'h-8 gap-1.5 px-2 text-xs');
  return (
    <div className={shellClass} role="group" aria-label="Snap settings">
      <WorkspaceTooltip label="Snap to grid">
        <Button
          type="button"
          size={isCompact ? 'icon' : 'sm'}
          variant="ghost"
          aria-pressed={props.isGridSnapEnabled}
          aria-label="Snap to grid"
          className={cn(buttonClass, props.isGridSnapEnabled && WORKSPACE_CHROME_ACTIVE_SKY_CLASS)}
          onClick={props.onToggleGridSnap}
        >
          <Grid3x3 className="size-3.5 shrink-0" aria-hidden />
          {isCompact ? null : 'Grid'}
        </Button>
      </WorkspaceTooltip>
      <WorkspaceTooltip label="Snap align to other nodes">
        <Button
          type="button"
          size={isCompact ? 'icon' : 'sm'}
          variant="ghost"
          aria-pressed={props.isAlignmentSnapEnabled}
          aria-label="Snap align to other nodes"
          className={cn(buttonClass, props.isAlignmentSnapEnabled && WORKSPACE_CHROME_ACTIVE_SKY_CLASS)}
          onClick={props.onToggleAlignmentSnap}
        >
          <Magnet className="size-3.5 shrink-0" aria-hidden />
          {isCompact ? null : 'Align'}
        </Button>
      </WorkspaceTooltip>
    </div>
  );
}
