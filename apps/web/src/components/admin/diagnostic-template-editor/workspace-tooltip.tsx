'use client';

import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WORKSPACE_TOOLTIP_CLASS } from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type WorkspaceTooltipProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly className?: string;
  /** Dark tooltip for the workspace canvas; default uses theme popover styles. */
  readonly tone?: 'workspace' | 'default';
};

export function WorkspaceTooltip(props: WorkspaceTooltipProps): ReactElement {
  const isWorkspaceTone = props.tone !== 'default';
  return (
    <Tooltip>
      <TooltipTrigger asChild>{props.children}</TooltipTrigger>
      <TooltipContent
        side={props.side ?? 'bottom'}
        className={cn(
          isWorkspaceTone && WORKSPACE_TOOLTIP_CLASS,
          props.className,
        )}
      >
        {props.label}
      </TooltipContent>
    </Tooltip>
  );
}
