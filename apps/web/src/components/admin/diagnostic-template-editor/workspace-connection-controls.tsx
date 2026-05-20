'use client';

import { ArrowDownUp, ArrowRightLeft, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';
import type { WorkspaceStructuralConnectionOrientation } from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { Button } from '@/components/ui/button';
import {
  WORKSPACE_CHROME_ACTIVE_VIOLET_CLASS,
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type WorkspaceConnectionControlsProps = {
  readonly orientation: WorkspaceStructuralConnectionOrientation;
  readonly onSelectOrientation: (orientation: WorkspaceStructuralConnectionOrientation) => void;
  readonly compact?: boolean;
};

const ORIENTATION_OPTIONS: readonly {
  readonly id: WorkspaceStructuralConnectionOrientation;
  readonly label: string;
  readonly title: string;
  readonly icon: typeof ArrowDownUp;
}[] = [
  { id: 'vertical', label: 'Vertical', title: 'Question→option links use top/bottom handles', icon: ArrowDownUp },
  { id: 'horizontal', label: 'Horizontal', title: 'Question→option links use left/right handles', icon: ArrowRightLeft },
  { id: 'auto', label: 'Auto', title: 'Pick vertical or horizontal from node positions', icon: Sparkles },
];

export function WorkspaceConnectionControls(props: WorkspaceConnectionControlsProps): ReactElement {
  const isCompact = props.compact === true;
  return (
    <div
      className={cn(
        'flex items-center gap-0',
        !isCompact && cn('gap-1 rounded-xl p-1', WORKSPACE_CHROME_SHELL_CLASS),
      )}
      role="group"
      aria-label="Structural connection orientation"
    >
      {ORIENTATION_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = props.orientation === option.id;
        return (
          <WorkspaceTooltip key={option.id} label={option.title}>
            <Button
              type="button"
              size={isCompact ? 'icon' : 'sm'}
              variant="ghost"
              aria-label={option.label}
              aria-pressed={isActive}
              className={cn(
                WORKSPACE_CHROME_BUTTON_CLASS,
                isCompact ? 'size-7 shrink-0' : 'h-8 gap-1.5 px-2 text-xs',
                isActive && WORKSPACE_CHROME_ACTIVE_VIOLET_CLASS,
              )}
              onClick={() => props.onSelectOrientation(option.id)}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {isCompact ? null : option.label}
            </Button>
          </WorkspaceTooltip>
        );
      })}
    </div>
  );
}
