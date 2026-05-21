'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useWorkspaceFullscreen } from '@/components/admin/diagnostic-template-editor/workspace-fullscreen-context';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { Button } from '@/components/ui/button';
import {
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type WorkspaceFullscreenToggleProps = {
  readonly compact?: boolean;
  readonly variant?: 'ghost' | 'outline';
};

export function WorkspaceFullscreenToggle(props: WorkspaceFullscreenToggleProps): ReactElement {
  const { isFullscreen, toggleFullscreen } = useWorkspaceFullscreen();
  const Icon = isFullscreen ? Minimize2 : Maximize2;
  const label = isFullscreen ? 'Exit full screen (Esc)' : 'Full screen';
  const variant = props.variant ?? 'ghost';
  return (
    <WorkspaceTooltip label={label} tone="workspace">
      <Button
        type="button"
        size="sm"
        variant={variant}
        aria-pressed={isFullscreen}
        aria-label={label}
        className={cn(
          'gap-1.5',
          variant === 'ghost' && WORKSPACE_CHROME_BUTTON_CLASS,
          variant === 'outline' && WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS,
        )}
        onClick={toggleFullscreen}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {props.compact ? <span className="sr-only">{label}</span> : isFullscreen ? 'Exit full screen' : 'Full screen'}
      </Button>
    </WorkspaceTooltip>
  );
}
